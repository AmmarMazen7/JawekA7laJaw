'use client'

import { useState, useEffect } from 'react'
import { Bot, Sparkles, ChevronUp, AlertCircle, CheckCircle, TrendingUp, Zap } from 'lucide-react'

interface AIRecommendation {
    priority: string
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
}

interface FloatingAIButtonProps {
    onScrollToRecommendations: () => void
    analyticsData?: any
}

export function FloatingAIButton({ onScrollToRecommendations, analyticsData }: FloatingAIButtonProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [instantInsight, setInstantInsight] = useState<string>("Analyzing queue...")
    const [priorityAction, setPriorityAction] = useState<string>("Loading recommendations...")
    const [alertLevel, setAlertLevel] = useState<'normal' | 'warning' | 'critical'>('normal')
    const [confidence, setConfidence] = useState<number>(0)
    const [aiPowered, setAiPowered] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState(false)

    // Fetch instant recommendations
    const fetchInstantRecommendations = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('http://localhost:8000/api/recommendations/instant')
            const data = await response.json()

            if (data.success) {
                setInstantInsight(data.instant_insight)
                setPriorityAction(data.priority_action)
                setAlertLevel(data.alert_level)
                setConfidence(data.confidence)
                setAiPowered(data.ai_powered)
            }
        } catch (error) {
            console.error('Failed to fetch instant recommendations:', error)
            setInstantInsight("Queue monitoring active")
            setPriorityAction("Continue normal operations")
        } finally {
            setIsLoading(false)
        }
    }

    // Auto-refresh recommendations every 30 seconds
    useEffect(() => {
        fetchInstantRecommendations()
        const interval = setInterval(fetchInstantRecommendations, 30000)
        return () => clearInterval(interval)
    }, [analyticsData])

    const getAlertColor = () => {
        switch (alertLevel) {
            case 'critical': return 'from-red-500 to-red-600'
            case 'warning': return 'from-yellow-500 to-orange-500'
            default: return 'from-blue-500 to-purple-600'
        }
    }

    const getAlertIcon = () => {
        switch (alertLevel) {
            case 'critical': return <AlertCircle className="w-4 h-4" />
            case 'warning': return <TrendingUp className="w-4 h-4" />
            default: return <CheckCircle className="w-4 h-4" />
        }
    }

    const handleClick = () => {
        if (isExpanded) {
            onScrollToRecommendations()
        } else {
            setIsExpanded(true)
            // Auto-collapse after 10 seconds
            setTimeout(() => setIsExpanded(false), 10000)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Expanded View */}
            {isExpanded && (
                <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-80 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-r ${getAlertColor()}`}>
                            {aiPowered ? <Sparkles className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm flex items-center gap-1">
                                AI Queue Assistant
                                {getAlertIcon()}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {aiPowered ? 'OpenAI Powered' : 'Rule-based'} • {confidence}% confidence
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Current Insight
                            </p>
                            <p className="text-sm text-foreground">{instantInsight}</p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Priority Action
                            </p>
                            <p className="text-sm font-medium text-foreground">{priorityAction}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => onScrollToRecommendations()}
                        className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <Zap className="w-4 h-4" />
                        View Full Recommendations
                        <ChevronUp className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={handleClick}
                className={`
          relative bg-gradient-to-r ${getAlertColor()} hover:shadow-lg 
          text-white rounded-full p-4 shadow-lg transition-all duration-300 
          hover:scale-105 active:scale-95 group
          ${isExpanded ? 'scale-105' : ''}
        `}
                title={isExpanded ? "View full recommendations" : "Get AI recommendations"}
            >
                {/* Pulse Animation for Critical Alerts */}
                {alertLevel === 'critical' && (
                    <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
                )}

                {/* Main Icon */}
                <div className="relative">
                    {isLoading ? (
                        <div className="animate-spin">
                            <Bot className="w-6 h-6" />
                        </div>
                    ) : aiPowered ? (
                        <Sparkles className="w-6 h-6" />
                    ) : (
                        <Bot className="w-6 h-6" />
                    )}
                </div>

                {/* Notification Badge */}
                {alertLevel !== 'normal' && !isExpanded && (
                    <div className={`
            absolute -top-1 -right-1 w-3 h-3 rounded-full 
            ${alertLevel === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}
            animate-pulse
          `}></div>
                )}
            </button>
        </div>
    )
}