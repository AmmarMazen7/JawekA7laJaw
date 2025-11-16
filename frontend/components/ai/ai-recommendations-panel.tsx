'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Lightbulb, Target, DollarSign, Users, RefreshCw, Zap } from 'lucide-react'

interface AIRecommendation {
    priority: 'high' | 'medium' | 'low'
    action: string
    reason: string
    impact: string
}

interface AIRecommendationsData {
    priority_recommendations: AIRecommendation[]
    insights: string[]
    business_impact: {
        efficiency_score: number
        estimated_revenue_impact: string
        customer_satisfaction: string
    }
    immediate_actions: AIRecommendation[]
    strategic_improvements: string[]
    alert_level: 'normal' | 'warning' | 'critical'
    confidence_score: number
    ai_powered: boolean
    generated_at: string
}

interface AIRecommendationsPanelProps {
    analyticsData?: any
    className?: string
}

export function AIRecommendationsPanel({ analyticsData, className = "" }: AIRecommendationsPanelProps) {
    const [recommendations, setRecommendations] = useState<AIRecommendationsData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<string>("")
    const panelRef = useRef<HTMLDivElement>(null)

    // Expose scroll function to parent component
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).scrollToRecommendations = () => {
                panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
    }, [])

    const generateRecommendations = async () => {
        setIsLoading(true)
        try {
            const dataToSend = {
                zones: analyticsData?.zones || [{
                    id: "main",
                    name: "Main Queue",
                    count: 12,
                    wait_time: 3.2,
                    efficiency: 85
                }],
                timestamp: new Date().toISOString(),
                business_hours: true,
                peak_time: new Date().getHours() >= 12 && new Date().getHours() <= 14
            }

            // Use frontend API route instead of backend
            const response = await fetch('/api/ai/recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend)
            })

            const data = await response.json()

            if (data.priority_recommendations) {
                // Transform the data to match our interface
                setRecommendations({
                    priority_recommendations: data.priority_recommendations,
                    insights: data.strategic_insights || [],
                    business_impact: data.business_impact,
                    immediate_actions: data.priority_recommendations.filter((r: any) => r.priority === 'high'),
                    strategic_improvements: data.strategic_insights || [],
                    alert_level: data.alert_level || 'normal',
                    confidence_score: data.confidence_score,
                    ai_powered: data.ai_powered,
                    generated_at: new Date().toISOString()
                })
                setLastUpdated(new Date().toLocaleTimeString())
            } else {
                console.error('Invalid recommendations format:', data)
                setFallbackRecommendations()
            }
        } catch (error) {
            console.error('Error generating recommendations:', error)
            setFallbackRecommendations()
        } finally {
            setIsLoading(false)
        }
    }

    const setFallbackRecommendations = () => {
        setRecommendations({
            priority_recommendations: [{
                priority: 'medium',
                action: 'Monitor queue performance',
                reason: 'Unable to connect to AI service',
                impact: 'Maintain current operations'
            }],
            insights: ['System monitoring active'],
            business_impact: {
                efficiency_score: 75,
                estimated_revenue_impact: 'Stable',
                customer_satisfaction: 'Good'
            },
            immediate_actions: [],
            strategic_improvements: ['Check AI configuration', 'Monitor queue manually'],
            alert_level: 'warning',
            confidence_score: 50,
            ai_powered: false,
            generated_at: new Date().toISOString()
        })
        setLastUpdated(new Date().toLocaleTimeString())
    }

    // Auto-generate recommendations when analytics data changes
    useEffect(() => {
        if (analyticsData) {
            generateRecommendations()
        }
    }, [analyticsData])

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
            case 'low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            default: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
        }
    }

    const getAlertLevelStyle = () => {
        if (!recommendations) return 'border-gray-200'

        switch (recommendations.alert_level) {
            case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950'
            case 'warning': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
            default: return 'border-green-500 bg-green-50 dark:bg-green-950'
        }
    }

    return (
        <div ref={panelRef} className={`bg-card rounded-lg border border-border p-6 ${getAlertLevelStyle()} ${className}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                        {recommendations?.ai_powered ? (
                            <Sparkles className="w-6 h-6 text-white" />
                        ) : (
                            <Bot className="w-6 h-6 text-white" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            AI Queue Recommendations
                            {recommendations?.alert_level === 'critical' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                            {recommendations?.alert_level === 'warning' && <TrendingUp className="w-5 h-5 text-yellow-500" />}
                            {recommendations?.alert_level === 'normal' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {recommendations?.ai_powered ? 'OpenAI GPT-4 Analysis' : 'Rule-based Analysis'}
                            {recommendations && ` • ${recommendations.confidence_score}% confidence`}
                            {lastUpdated && ` • Updated ${lastUpdated}`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={generateRecommendations}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Analyzing...' : 'Refresh'}
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin mb-4 mx-auto">
                        <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-lg font-medium">Generating intelligent recommendations...</p>
                    <p className="text-sm text-muted-foreground">Analyzing queue patterns with AI</p>
                </div>
            ) : recommendations ? (
                <div className="space-y-6">
                    {/* Business Impact Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="w-5 h-5 text-blue-500" />
                                <span className="font-semibold text-sm">Efficiency Score</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{recommendations.business_impact.efficiency_score}%</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-5 h-5 text-green-500" />
                                <span className="font-semibold text-sm">Revenue Impact</span>
                            </div>
                            <p className="text-lg font-bold text-green-600">{recommendations.business_impact.estimated_revenue_impact}</p>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-5 h-5 text-purple-500" />
                                <span className="font-semibold text-sm">Customer Satisfaction</span>
                            </div>
                            <p className="text-lg font-bold text-purple-600">{recommendations.business_impact.customer_satisfaction}</p>
                        </div>
                    </div>

                    {/* Priority Recommendations */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            Priority Actions
                        </h4>
                        <div className="space-y-3">
                            {recommendations.priority_recommendations.map((rec, index) => (
                                <div key={index} className="bg-muted rounded-lg p-4 border border-border">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(rec.priority)}`}>
                                            {rec.priority.toUpperCase()} PRIORITY
                                        </span>
                                    </div>
                                    <h5 className="font-semibold mb-1">{rec.action}</h5>
                                    <p className="text-sm text-muted-foreground mb-2">{rec.reason}</p>
                                    <p className="text-sm font-medium text-green-600">Expected Impact: {rec.impact}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Key Insights */}
                    <div>
                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-yellow-500" />
                            Key Insights
                        </h4>
                        <div className="bg-muted rounded-lg p-4">
                            <ul className="space-y-2">
                                {recommendations.insights.map((insight, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm">
                                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Strategic Improvements */}
                    {recommendations.strategic_improvements.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                Strategic Improvements
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {recommendations.strategic_improvements.map((improvement, index) => (
                                    <div key={index} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                        <p className="text-sm font-medium">{improvement}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12">
                    <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No recommendations available</p>
                    <p className="text-sm text-muted-foreground mb-4">Upload and analyze a video to get AI-powered recommendations</p>
                    <button
                        onClick={generateRecommendations}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors mx-auto"
                    >
                        <Sparkles className="w-4 h-4" />
                        Generate Sample Recommendations
                    </button>
                </div>
            )}
        </div>
    )
}