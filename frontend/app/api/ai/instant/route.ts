import { aiService } from '@/lib/ai-service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const videoId = searchParams.get('video_id');

        const instant = await aiService.getInstantRecommendations(videoId || undefined);

        return new Response(JSON.stringify(instant), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Instant recommendations API error:', error);

        return new Response(JSON.stringify({
            recommendation: 'Monitor current queue status and adjust as needed',
            alert_level: 'warning',
            confidence: 60
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}