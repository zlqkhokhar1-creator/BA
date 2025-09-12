import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { Order, OrderStatus, OrderType } from '../entities/order.entity'
import { Portfolio } from '../entities/portfolio.entity'
import { MarketDataService } from '../market-data/market-data.service'
import { RiskManagementService } from '../risk/risk-management.service'
import { AITradingService } from '../ai/ai-trading.service'

@Injectable()
export class TradingEngineService {
  private readonly logger = new Logger(TradingEngineService.name)

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    private marketDataService: MarketDataService,
    private riskManagementService: RiskManagementService,
    private aiTradingService: AITradingService,
    private eventEmitter: EventEmitter2,
  ) {}

  async placeOrder(orderData: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create(orderData)
    
    // Pre-trade risk checks
    const riskAssessment = await this.riskManagementService.assessOrderRisk(order)
    if (!riskAssessment.approved) {
      throw new Error(`Order rejected: ${riskAssessment.reason}`)
    }

    // AI-powered order optimization
    const aiRecommendations = await this.aiTradingService.optimizeOrder(order)
    if (aiRecommendations.shouldModify) {
      order.price = aiRecommendations.suggestedPrice
      order.quantity = aiRecommendations.suggestedQuantity
    }

    // Save order
    const savedOrder = await this.orderRepository.save(order)
    
    // Process order based on type
    if (order.type === OrderType.MARKET) {
      await this.executeMarketOrder(savedOrder)
    } else {
      await this.processLimitOrder(savedOrder)
    }

    // Emit order placed event
    this.eventEmitter.emit('order.placed', savedOrder)
    
    return savedOrder
  }

  private async executeMarketOrder(order: Order): Promise<void> {
    try {
      const currentPrice = await this.marketDataService.getCurrentPrice(order.symbol)
      
      // Execute the order at current market price
      order.executedPrice = currentPrice
      order.executedQuantity = order.quantity
      order.status = OrderStatus.FILLED
      order.executedAt = new Date()

      await this.orderRepository.save(order)
      await this.updatePortfolio(order)

      this.eventEmitter.emit('order.executed', order)
      this.logger.log(`Market order executed: ${order.id}`)
    } catch (error) {
      order.status = OrderStatus.REJECTED
      await this.orderRepository.save(order)
      this.logger.error(`Failed to execute market order: ${order.id}`, error)
    }
  }

  private async processLimitOrder(order: Order): Promise<void> {
    // Add to order book for matching
    order.status = OrderStatus.PENDING
    await this.orderRepository.save(order)
    
    // Start price monitoring for limit orders
    this.startPriceMonitoring(order)
  }

  private startPriceMonitoring(order: Order): void {
    const priceSubscription = this.marketDataService.subscribeToPrice(order.symbol)
    
    priceSubscription.subscribe(async (currentPrice: number) => {
      const shouldExecute = order.side === 'BUY' 
        ? currentPrice <= order.price
        : currentPrice >= order.price

      if (shouldExecute) {
        await this.executeLimitOrder(order, currentPrice)
      }
    })
  }

  private async executeLimitOrder(order: Order, executionPrice: number): Promise<void> {
    order.executedPrice = executionPrice
    order.executedQuantity = order.quantity
    order.status = OrderStatus.FILLED
    order.executedAt = new Date()

    await this.orderRepository.save(order)
    await this.updatePortfolio(order)

    this.eventEmitter.emit('order.executed', order)
    this.logger.log(`Limit order executed: ${order.id}`)
  }

  private async updatePortfolio(order: Order): Promise<void> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { userId: order.userId }
    })

    if (!portfolio) {
      throw new Error('Portfolio not found')
    }

    // Update portfolio positions
    const totalValue = order.executedPrice * order.executedQuantity
    
    if (order.side === 'BUY') {
      portfolio.cashBalance -= totalValue
      // Add to positions
    } else {
      portfolio.cashBalance += totalValue
      // Remove from positions
    }

    await this.portfolioRepository.save(portfolio)
    this.eventEmitter.emit('portfolio.updated', portfolio)
  }

  @OnEvent('market.data.update')
  async handleMarketDataUpdate(data: any): Promise<void> {
    // Handle real-time market data updates
    // Trigger any pending order executions
    // Update risk calculations
    this.logger.debug(`Processing market data update for ${data.symbol}`)
  }
}