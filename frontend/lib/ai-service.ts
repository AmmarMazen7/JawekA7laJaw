import OpenAI from 'openai';

interface QueueZone {
    id: string;
    name: string;
    count: number;
    wait_time: number;
    efficiency: number;
    alerts?: string[];
}

interface RecommendationRequest {
    zones: QueueZone[];
    timestamp: string;
    business_hours?: boolean;
    peak_time?: boolean;
}

interface AIRecommendation {
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    impact: string;
    category: 'staffing' | 'operations' | 'customer_experience' | 'efficiency';
}

interface AIResponse {
    priority_recommendations: AIRecommendation[];
    business_impact: {
        efficiency_score: number;
        estimated_revenue_impact: string;
        customer_satisfaction: string;
    };
    strategic_insights: string[];
    alert_level: 'success' | 'warning' | 'critical';
    confidence_score: number;
    ai_powered: boolean;
}

class AIRecommendationService {
    private client: OpenAI | null = null;
    private model: string;

    constructor() {
        this.model = process.env.AI_MODEL || 'openai/gpt-4o-mini';
        this.initializeClient();
    }

    private initializeClient(): void {
        try {
            // Support both OpenRouter and direct OpenAI
            const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
            const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

            if (!apiKey) {
                console.warn('No API key found for AI service. AI recommendations will be unavailable.');
                return;
            }

            this.client = new OpenAI({
                apiKey,
                baseURL,
            });

            console.log(`AI Service initialized with model: ${this.model}`);
        } catch (error) {
            console.error('Failed to initialize AI client:', error);
            this.client = null;
        }
    }

    async generateRecommendations(request: RecommendationRequest): Promise<AIResponse> {
        if (!this.client) {
            return this.getFallbackRecommendations(request);
        }

        try {
            const prompt = this.buildPrompt(request);

            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI consultant specialized in queue management and business operations for retail establishments. Provide actionable, data-driven recommendations in valid JSON format only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000,
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from AI model');
            }

            // Parse and validate the JSON response
            const aiResponse = JSON.parse(response) as AIResponse;
            aiResponse.ai_powered = true;

            return aiResponse;

        } catch (error) {
            console.error('AI recommendation error:', error);
            return this.getFallbackRecommendations(request);
        }
    }

    async getInstantRecommendations(videoId?: string): Promise<{
        recommendation: string;
        alert_level: 'success' | 'warning' | 'critical';
        confidence: number;
    }> {
        if (!this.client) {
            return {
                recommendation: "Add AI configuration to get personalized recommendations",
                alert_level: 'warning' as const,
                confidence: 0
            };
        }

        try {
            // Simulate quick analysis for instant recommendations
            const quickPrompt = `Based on current queue analytics, provide a single, immediate actionable recommendation for a bakery/patisserie. Respond in JSON format:
      {
        "recommendation": "specific action to take right now",
        "alert_level": "success/warning/critical",
        "confidence": 85
      }`;

            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: 'Provide quick, actionable queue management advice in JSON format.' },
                    { role: 'user', content: quickPrompt }
                ],
                temperature: 0.5,
                max_tokens: 150,
            });

            const response = completion.choices[0]?.message?.content;
            if (response) {
                return JSON.parse(response);
            }
        } catch (error) {
            console.error('Instant recommendation error:', error);
        }

        // Fallback instant recommendation
        return {
            recommendation: "Monitor queue patterns and consider staff adjustment during peak hours",
            alert_level: 'warning' as const,
            confidence: 70
        };
    }

    private buildPrompt(request: RecommendationRequest): string {
        const zonesData = request.zones.map(zone =>
            `Zone "${zone.name}": ${zone.count} people, ${zone.wait_time}min wait, ${zone.efficiency}% efficiency`
        ).join('\n');

        return `Analyze this queue data for a bakery/patisserie and provide actionable recommendations:

${zonesData}

Timestamp: ${request.timestamp}
Business Context: ${request.peak_time ? 'Peak hours' : 'Regular hours'}

Provide response in this exact JSON format:
{
  "priority_recommendations": [
    {
      "priority": "high/medium/low",
      "action": "specific action to take",
      "reason": "data-driven explanation", 
      "impact": "expected outcome",
      "category": "staffing/operations/customer_experience/efficiency"
    }
  ],
  "business_impact": {
    "efficiency_score": 85,
    "estimated_revenue_impact": "+$150/day",
    "customer_satisfaction": "Good/Needs Improvement/Excellent"
  },
  "strategic_insights": [
    "actionable insight 1",
    "actionable insight 2"
  ],
  "alert_level": "success/warning/critical",
  "confidence_score": 90
}`;
    }

    private getFallbackRecommendations(request: RecommendationRequest): AIResponse {
        const totalCustomers = request.zones.reduce((sum, zone) => sum + zone.count, 0);
        const avgWaitTime = request.zones.reduce((sum, zone) => sum + zone.wait_time, 0) / request.zones.length;

        let alertLevel: 'success' | 'warning' | 'critical' = 'success';
        let recommendations: AIRecommendation[] = [];

        if (avgWaitTime > 5) {
            alertLevel = 'critical';
            recommendations.push({
                priority: 'high',
                action: 'Add additional staff immediately',
                reason: `Average wait time of ${avgWaitTime.toFixed(1)} minutes exceeds optimal threshold`,
                impact: 'Reduce customer abandonment and improve satisfaction',
                category: 'staffing'
            });
        } else if (avgWaitTime > 3) {
            alertLevel = 'warning';
            recommendations.push({
                priority: 'medium',
                action: 'Monitor queue flow and prepare backup staff',
                reason: `Wait times approaching suboptimal levels`,
                impact: 'Prevent queue buildup during peak periods',
                category: 'operations'
            });
        }

        if (totalCustomers > 15) {
            recommendations.push({
                priority: 'medium',
                action: 'Implement express lane for simple purchases',
                reason: 'High customer volume detected',
                impact: 'Improve overall queue efficiency by 25%',
                category: 'customer_experience'
            });
        }

        return {
            priority_recommendations: recommendations.length > 0 ? recommendations : [
                {
                    priority: 'low',
                    action: 'Continue current operations',
                    reason: 'Queue performance within optimal parameters',
                    impact: 'Maintain excellent customer experience',
                    category: 'operations'
                }
            ],
            business_impact: {
                efficiency_score: Math.max(60, 100 - (avgWaitTime * 10)),
                estimated_revenue_impact: totalCustomers > 10 ? '+$50/day' : 'Stable',
                customer_satisfaction: avgWaitTime < 3 ? 'Excellent' : avgWaitTime < 5 ? 'Good' : 'Needs Improvement'
            },
            strategic_insights: [
                'Consider implementing mobile ordering for peak times',
                'Track customer patterns to optimize staffing schedules'
            ],
            alert_level: alertLevel,
            confidence_score: 75,
            ai_powered: false
        };
    }
}

// Export singleton instance
export const aiService = new AIRecommendationService();
export type { AIResponse, AIRecommendation, QueueZone, RecommendationRequest };