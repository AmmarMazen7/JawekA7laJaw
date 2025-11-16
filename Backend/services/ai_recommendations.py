import openai
import os
import logging
import json
from typing import Dict, Any, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class OpenAIRecommendationService:
    """
    Intelligent recommendation service using OpenAI GPT for queue management insights
    """
    
    def __init__(self):
        # Initialize OpenRouter client (alternative to direct OpenAI)
        api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
        
        if not api_key:
            logger.warning("OpenRouter/OpenAI API key not found. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.")
            self.client = None
        else:
            try:
                self.client = openai.OpenAI(
                    api_key=api_key,
                    base_url=base_url
                )
                logger.info(f"OpenAI client initialized successfully with base URL: {base_url}")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                self.client = None
    
    def generate_recommendations(self, analytics_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate intelligent recommendations based on queue analytics data
        
        Args:
            analytics_data: Dictionary containing queue metrics and analytics
            
        Returns:
            Dictionary with AI-generated recommendations, insights, and actions
        """
        if not self.client:
            return self._fallback_recommendations(analytics_data)
        
        try:
            # Prepare the analytics context for the AI
            context = self._prepare_analytics_context(analytics_data)
            
            # Create the intelligent prompt
            prompt = self._create_intelligent_prompt(context)
            
            # Get AI recommendations with model selection
            model_name = os.getenv("AI_MODEL", "openai/gpt-4o-mini")  # Default to cost-effective model
            
            response = self.client.chat.completions.create(
                model=model_name,  # OpenRouter supports many models: openai/gpt-4o-mini, anthropic/claude-3-haiku, etc.
                messages=[
                    {
                        "role": "system", 
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=800,
                temperature=0.3,  # Lower temperature for more focused recommendations
                response_format={"type": "json_object"}
            )
            
            # Parse the AI response safely
            ai_response = response.choices[0].message.content
            try:
                recommendations = json.loads(ai_response)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response as JSON: {str(e)}")
                logger.debug(f"AI Response: {ai_response}")
                return self._fallback_recommendations(analytics_data)
            
            # Add metadata
            recommendations["ai_powered"] = True
            recommendations["generated_at"] = analytics_data.get("timestamp", "now")
            
            logger.info("Successfully generated AI recommendations")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate AI recommendations: {str(e)}")
            return self._fallback_recommendations(analytics_data)
    
    def _get_system_prompt(self) -> str:
        """
        Get the system prompt that defines the AI's role and expertise
        """
        return """
You are an expert queue management consultant and business optimization specialist for patisseries and bakeries. 
Your role is to analyze queue analytics data and provide actionable, intelligent recommendations to improve:

1. **Customer Experience**: Reduce wait times, eliminate frustration, improve satisfaction
2. **Operational Efficiency**: Optimize staff allocation, streamline processes, reduce costs
3. **Revenue Generation**: Minimize customer abandonment, increase throughput, maximize sales
4. **Strategic Planning**: Predict peak hours, plan capacity, optimize layouts

**Your expertise includes:**
- Queue theory and customer flow optimization
- Retail operations and staff management
- Customer behavior psychology
- Revenue optimization strategies
- Patisserie/bakery industry specifics

**Response Format:**
Always respond with a valid JSON object containing:
- "priority_recommendations": Array of 3-5 high-impact actions with priority levels
- "insights": Key analytical insights from the data
- "business_impact": Estimated impact on revenue, efficiency, and customer satisfaction
- "immediate_actions": Actions to take in the next hour
- "strategic_improvements": Long-term optimization suggestions
- "alert_level": Overall situation assessment (normal/warning/critical)
- "confidence_score": How confident you are in these recommendations (0-100)

Be specific, actionable, and focused on measurable business outcomes.
"""

    def _create_intelligent_prompt(self, context: Dict[str, Any]) -> str:
        """
        Create an intelligent prompt based on current queue analytics
        """
        return f"""
Analyze the following real-time queue analytics for a patisserie and provide intelligent recommendations:

**CURRENT QUEUE METRICS:**
{context['current_metrics']}

**ZONE PERFORMANCE:**
{context['zone_data']}

**HISTORICAL TRENDS:**
{context['trends']}

**BUSINESS CONTEXT:**
- Business Type: Patisserie/Bakery
- Peak Hours: Usually 8-10 AM, 12-2 PM, 5-7 PM
- Average Transaction: $15
- Target Service Time: Under 2 minutes per customer
- Customer Abandonment Cost: $25 per lost customer

**SPECIFIC ANALYSIS NEEDED:**
1. Is current performance meeting business targets?
2. What immediate actions would have the highest impact?
3. Are there staffing optimization opportunities?
4. What patterns suggest future problems?
5. How can we improve customer experience right now?

Provide specific, actionable recommendations that a patisserie manager can implement immediately.
"""

    def _prepare_analytics_context(self, analytics_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare analytics data into a structured context for the AI
        """
        # Extract key metrics
        zones = analytics_data.get("zones", [])
        
        # Summarize current metrics
        total_customers = sum(zone.get("metrics", {}).get("num_people_measured", 0) for zone in zones)
        avg_wait_times = [zone.get("metrics", {}).get("avg_wait", 0) for zone in zones if zone.get("metrics", {}).get("avg_wait")]
        avg_wait = sum(avg_wait_times) / len(avg_wait_times) if avg_wait_times else 0
        
        # Calculate queue lengths
        queue_lengths = [zone.get("metrics", {}).get("avg_queue_len", 0) for zone in zones]
        max_queue = max(queue_lengths) if queue_lengths else 0
        
        # Determine business impact
        efficiency_score = min(100, max(0, 100 - (avg_wait - 120) / 60 * 10)) if avg_wait > 0 else 100
        
        context = {
            "current_metrics": {
                "total_customers_analyzed": total_customers,
                "average_wait_time_seconds": round(avg_wait, 1),
                "maximum_queue_length": max_queue,
                "number_of_zones": len(zones),
                "efficiency_score": round(efficiency_score, 1),
                "peak_activity_detected": avg_wait > 180 or max_queue > 6
            },
            "zone_data": [
                {
                    "zone_name": zone.get("zone_name", "Unknown"),
                    "customers": zone.get("metrics", {}).get("num_people_measured", 0),
                    "avg_wait_seconds": zone.get("metrics", {}).get("avg_wait", 0),
                    "max_wait_seconds": zone.get("metrics", {}).get("max_wait", 0),
                    "queue_length": zone.get("metrics", {}).get("avg_queue_len", 0),
                    "performance_status": self._assess_zone_performance(zone.get("metrics", {}))
                }
                for zone in zones
            ],
            "trends": {
                "wait_time_trend": "increasing" if avg_wait > 120 else "stable",
                "customer_volume": "high" if total_customers > 50 else "moderate",
                "service_pressure": "high" if any(zone.get("metrics", {}).get("avg_wait", 0) > 180 for zone in zones) else "normal"
            }
        }
        
        return context
    
    def _assess_zone_performance(self, metrics: Dict[str, Any]) -> str:
        """
        Assess the performance status of a single zone
        """
        avg_wait = metrics.get("avg_wait", 0)
        queue_len = metrics.get("avg_queue_len", 0)
        
        if avg_wait > 180 or queue_len > 6:
            return "critical"
        elif avg_wait > 120 or queue_len > 4:
            return "warning"
        else:
            return "good"
    
    def _fallback_recommendations(self, analytics_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback recommendations when OpenAI is not available
        """
        zones = analytics_data.get("zones", [])
        
        # Calculate basic metrics
        total_customers = sum(zone.get("metrics", {}).get("num_people_measured", 0) for zone in zones)
        avg_wait_times = [zone.get("metrics", {}).get("avg_wait", 0) for zone in zones if zone.get("metrics", {}).get("avg_wait")]
        avg_wait = sum(avg_wait_times) / len(avg_wait_times) if avg_wait_times else 0
        
        recommendations = []
        alert_level = "normal"
        
        # Generate rule-based recommendations
        if avg_wait > 180:  # 3 minutes
            recommendations.append({
                "priority": "high",
                "action": "Add additional staff immediately",
                "reason": f"Average wait time of {avg_wait/60:.1f} minutes exceeds target",
                "impact": "Reduce wait time by 40-60%"
            })
            alert_level = "critical"
        elif avg_wait > 120:  # 2 minutes
            recommendations.append({
                "priority": "medium",
                "action": "Consider adding express service lane",
                "reason": f"Wait time of {avg_wait/60:.1f} minutes approaching limit",
                "impact": "Improve customer satisfaction"
            })
            alert_level = "warning"
        
        if total_customers < 10:
            recommendations.append({
                "priority": "low",
                "action": "Current staffing appears adequate",
                "reason": "Low customer volume detected",
                "impact": "Maintain efficiency"
            })
        
        # Find busiest zone
        busiest_zone = max(zones, key=lambda z: z.get("metrics", {}).get("avg_queue_len", 0), default=None)
        if busiest_zone and busiest_zone.get("metrics", {}).get("avg_queue_len", 0) > 4:
            recommendations.append({
                "priority": "medium",
                "action": f"Optimize {busiest_zone['zone_name']} operations",
                "reason": f"Zone showing highest queue density",
                "impact": "Balance customer flow across zones"
            })
        
        return {
            "priority_recommendations": recommendations,
            "insights": [
                f"Analyzed {total_customers} customers across {len(zones)} zones",
                f"Average wait time: {avg_wait/60:.1f} minutes",
                f"Busiest zone: {busiest_zone['zone_name'] if busiest_zone else 'N/A'}"
            ],
            "business_impact": {
                "efficiency_score": min(100, max(0, 100 - (avg_wait - 120) / 60 * 10)),
                "estimated_revenue_impact": f"${(total_customers * 15):.0f} processed",
                "customer_satisfaction": "Good" if avg_wait < 120 else "Needs Improvement"
            },
            "immediate_actions": recommendations[:2] if recommendations else [],
            "strategic_improvements": [
                "Implement queue management system",
                "Train staff for faster service",
                "Consider layout optimization"
            ],
            "alert_level": alert_level,
            "confidence_score": 75,
            "ai_powered": False,
            "generated_at": analytics_data.get("timestamp", "now")
        }

# Global instance
recommendation_service = OpenAIRecommendationService()