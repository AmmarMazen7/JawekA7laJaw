import { aiService, type RecommendationRequest } from '@/lib/ai-service';

export async function POST(request: Request) {
    try {
        const body: RecommendationRequest = await request.json();

        // Validate request data
        if (!body.zones || !Array.isArray(body.zones)) {
            return new Response(
                JSON.stringify({ error: 'Invalid zones data provided' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Generate AI recommendations
        const recommendations = await aiService.generateRecommendations(body);

        return new Response(JSON.stringify(recommendations), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Recommendations API error:', error);

        const fallbackResponse = {
            error: 'Failed to generate recommendations',
            fallback: true,
            priority_recommendations: [
                {
                    priority: 'medium',
                    action: 'Review queue analytics and adjust staffing',
                    reason: 'AI service temporarily unavailable',
                    impact: 'Maintain operational efficiency',
                    category: 'operations'
                }
            ],
            business_impact: {
                efficiency_score: 70,
                estimated_revenue_impact: 'Stable',
                customer_satisfaction: 'Good'
            },
            strategic_insights: ['Monitor queue patterns manually', 'Check AI configuration'],
            alert_level: 'warning',
            confidence_score: 50,
            ai_powered: false
        };

        return new Response(JSON.stringify(fallbackResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}