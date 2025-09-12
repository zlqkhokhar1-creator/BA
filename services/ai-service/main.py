from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes import ai_router, predictions_router, sentiment_router
from app.services.ml_service import MLService
from app.services.trading_assistant import TradingAssistantService
from app.database.connection import init_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global ML service instance
ml_service = None
trading_assistant = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global ml_service, trading_assistant
    logger.info("Starting AI Service...")
    
    # Initialize database
    await init_db()
    
    # Initialize ML services
    ml_service = MLService()
    await ml_service.load_models()
    
    trading_assistant = TradingAssistantService()
    await trading_assistant.initialize()
    
    logger.info("AI Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down AI Service...")

app = FastAPI(
    title="AI Trading Service",
    description="Advanced AI and ML services for trading platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # JWT token validation logic here
    pass

# Include routers
app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI Services"])
app.include_router(predictions_router, prefix="/api/v1/predictions", tags=["Predictions"])
app.include_router(sentiment_router, prefix="/api/v1/sentiment", tags=["Sentiment Analysis"])

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": "1.0.0",
        "models_loaded": ml_service.models_loaded if ml_service else False
    }

@app.post("/api/v1/trading-assistant/chat")
async def chat_with_assistant(
    message: str,
    user_id: str,
    current_user = Depends(get_current_user)
):
    """
    Chat with AI trading assistant
    """
    try:
        response = await trading_assistant.process_message(message, user_id)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/predictions/price")
async def predict_price(
    symbol: str,
    timeframe: str = "1h",
    periods: int = 24,
    current_user = Depends(get_current_user)
):
    """
    Predict future price movements using ML models
    """
    try:
        predictions = await ml_service.predict_price(symbol, timeframe, periods)
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "predictions": predictions,
            "confidence": predictions.get("confidence", 0.0),
            "model_version": ml_service.get_model_version("price_prediction")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/portfolio-optimization")
async def optimize_portfolio(
    portfolio_data: dict,
    risk_tolerance: float,
    current_user = Depends(get_current_user)
):
    """
    AI-powered portfolio optimization
    """
    try:
        optimization = await ml_service.optimize_portfolio(
            portfolio_data, 
            risk_tolerance
        )
        return {
            "optimized_weights": optimization["weights"],
            "expected_return": optimization["expected_return"],
            "risk": optimization["risk"],
            "sharpe_ratio": optimization["sharpe_ratio"],
            "recommendations": optimization["recommendations"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )