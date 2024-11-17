import React from 'react';
import { Agent, Action, Prompt } from 'react-agents';
import { z } from 'zod';
import axios from 'axios';

export default function StockBotAgent() {
    // API Keys as variables
    const polygonApiKey = 'GfSpW14fQJ1L2VMApUciVRMTjznXxBqZ'; // I know I am supposed to not show them but then how are you guys gonna run the bot :P
    const stockNewsApiKey = 'ilhtepzhi9hwtej3djboamj9oaf1ediy1k2haddo';

    const fetchNews = async (ticker) => {
        try {
            const url = `https://stocknewsapi.com/api/v1/stat?&tickers=${ticker}&date=last30days&page=1&token=${stockNewsApiKey}`;
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching sentiment:', error.message);
            throw new Error('Failed to fetch sentiment. Please check the stock symbol or try again later.');
        }
    };

    const fetchStockPrices = async (ticker, startDate, endDate) => {
        try {
            const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&apiKey=${polygonApiKey}`;
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching stock prices:', error.message);
            throw new Error('Failed to fetch stock prices. Please check the stock symbol or try again later.');
        }
    };

    // Calculate Moving Average
    const calculateMovingAverage = (data, period) => {
        const movingAverages = [];
        for (let i = period - 1; i < data.length; i++) {
            const window = data.slice(i - period + 1, i + 1);
            const average = window.reduce((sum, value) => sum + value.c, 0) / period;
            movingAverages.push({ date: data[i].t, average });
        }
        return movingAverages;
    };

    // Calculate Exponential Moving Average
    const calculateEMA = (data, period) => {
        const k = 2 / (period + 1);
        let emaArray = [];
        let ema;

        data.forEach((value, index) => {
            if (index === 0) {
                ema = value.c;
            } else {
                ema = value.c * k + ema * (1 - k);
            }
            if (index >= period - 1) {
                emaArray.push({ date: value.t, ema });
            }
        });
        return emaArray;
    };

    // Calculate MACD
    const calculateMACD = (data) => {
        const ema12 = calculateEMA(data, 12);
        const ema26 = calculateEMA(data, 26);
        const macdArray = [];

        for (let i = 0; i < ema26.length; i++) {
            const macdValue = ema12[i + 14].ema - ema26[i].ema;
            macdArray.push({ date: ema26[i].date, macd: macdValue });
        }
        return macdArray;
    };



    return (
        <Agent>

            <Prompt>
                You are a stock market expert assistant. Your goal is to analyze a given stock ticker by fetching its latest
                news sentiment and historical price data. Use the following actions to perform your analysis:

                - **fetchNews**: Fetch the sentiment analysis from news for a stock ticker over the last 30 days.
                - **fetchStockPrices**: Fetch the historical stock prices for a given date range.
                - **calculateIndicators**: Calculate Moving Average, EMA, and MACD based on the fetched price data.
                - **analyzeStock**: Combine the sentiment and technical indicators to provide a comprehensive analysis and
                prediction.


                for AnalyzeStock try to give full insights on the stock and try to make it detailed with an explicit option
                - strong buy call
                - strong sell call
                - strong hold/wait call
                - weak buy call
                - weak sell call
                - weak hold/wait call
                when the user asks for anlysis of a stock or prediction always you analyzeStock
            </Prompt>

            {/* Action to fetch sentiment analysis */}
            <Action
                name="fetchNews"
                description="Fetch sentiment analysis for a stock ticker over the last 30 days"
                schema={z.object({ ticker: z.string() })}
                handler={async (e) => {
                    const { ticker } = e.data.message.args;
                    try {
                        const sentimentData = await fetchNews(ticker);
                        await e.data.agent.monologue(`Sentiment data for ${ticker}:\n\n${JSON.stringify(sentimentData, null, 2)}`);
                    } catch (error) {
                        await e.data.agent.monologue(error.message);
                    }
                    await e.commit();
                }}
            />

            {/* Action to fetch stock prices */}
            <Action
                name="fetchStockPrices"
                description="Fetch stock prices for a specific ticker and date range"
                schema={z.object({
                    ticker: z.string(),
                    startDate: z.string(), // Format: YYYY-MM-DD
                    endDate: z.string(),   // Format: YYYY-MM-DD
                })}
                handler={async (e) => {
                    const { ticker, startDate, endDate } = e.data.message.args;
                    try {
                        const priceData = await fetchStockPrices(ticker, startDate, endDate);
                        if (!priceData.results || priceData.results.length === 0) {
                            await e.data.agent.monologue(`No price data found for ${ticker} between ${startDate} and ${endDate}.`);
                            await e.commit();
                            return;
                        }

                        // Format the price data
                        const formattedPrices = priceData.results.map((data) => {
                            // Convert the timestamp to YYYY-MM-DD format
                            const date = new Date(data.t).toISOString().split('T')[0];
                            return `Date: ${date}, Open: ${data.o}, Close: ${data.c}, High: ${data.h}, Low: ${data.l}, Volume: ${data.v}`;
                        });

                        // Create the message
                        const message = `Stock prices for ${ticker} from ${startDate} to ${endDate}:\n\n${formattedPrices.join('\n')}`;

                        // Send the formatted price data to the user
                        await e.data.agent.monologue(message);
                    } catch (error) {
                        console.error('Error fetching stock prices:', error.message);
                        await e.data.agent.monologue('Failed to fetch stock prices. Please check the ticker symbol or try again later.');
                    }
                    await e.commit();
                }}
            />


            {/* Action to calculate technical indicators */}
            <Action
                name="calculateIndicators"
                description="Calculate Moving Average, EMA, and MACD for a stock based on price data"
                schema={z.object({
                    priceData: z.array(
                        z.object({
                            t: z.number(), // Timestamp
                            c: z.number(), // Close price
                        })
                    ),
                })}
                handler={async (e) => {
                    const { priceData } = e.data.message.args;
                    try {
                        const movingAverage = calculateMovingAverage(priceData, 10);
                        const ema = calculateEMA(priceData, 10);
                        const macd = calculateMACD(priceData);

                        await e.data.agent.monologue(`Calculated indicators:\n- Moving Average\n- EMA\n- MACD`);
                    } catch (error) {
                        await e.data.agent.monologue('Failed to calculate indicators.');
                    }
                    await e.commit();
                }}
            />

            {/* Action to analyze stock and provide prediction */}
            <Action
                name="analyzeStock"
                description="Analyze stock using sentiment and technical indicators, then provide a prediction"
                schema={z.object({
                    ticker: z.string(),
                })}
                handler={async (e) => {
                    const { ticker } = e.data.message.args;
                    try {
                        // Dates for the last 60 days
                        const today = new Date();
                        const sixtyDaysAgo = new Date(today);
                        sixtyDaysAgo.setDate(today.getDate() - 60);

                        const startDate = sixtyDaysAgo.toISOString().split('T')[0];
                        const endDate = today.toISOString().split('T')[0];

                        // Fetch sentiment
                        const sentimentData = await fetchNews(ticker);

                        // Fetch stock prices
                        const priceDataResponse = await fetchStockPrices(ticker, startDate, endDate);
                        const priceData = priceDataResponse.results;

                        if (!priceData || priceData.length === 0) {
                            await e.data.agent.monologue(`No price data found for ${ticker}.`);
                            return;
                        }

                        // Calculate indicators
                        const movingAverage = calculateMovingAverage(priceData, 10);
                        const ema = calculateEMA(priceData, 10);
                        const macd = calculateMACD(priceData);

                        // Get the latest data point
                        const latestPrice = priceData[priceData.length - 1].c;
                        const latestMA = movingAverage[movingAverage.length - 1].average;
                        const latestEMA = ema[ema.length - 1].ema;
                        const latestMACD = macd[macd.length - 1].macd;
                        const sentimentScore = sentimentData.total[ticker.toUpperCase()]['Sentiment Score'];

                        // Analysis
                        let analysis = `Analysis for ${ticker}:\n`;
                        analysis += `- Latest Close Price: $${latestPrice.toFixed(2)}\n`;
                        analysis += `- 10-day Moving Average: $${latestMA.toFixed(2)}\n`;
                        analysis += `- 10-day EMA: $${latestEMA.toFixed(2)}\n`;
                        analysis += `- MACD Value: ${latestMACD.toFixed(2)}\n`;
                        analysis += `- Sentiment Score (last 30 days): ${sentimentScore}\n\n`;

                        // Simple prediction logic
                        if (latestPrice > latestMA && latestMACD > 0 && sentimentScore > 0) {
                            analysis += `**Prediction:** The stock price is likely to increase based on positive momentum and sentiment.`;
                        } else if (latestPrice < latestMA && latestMACD < 0 && sentimentScore < 0) {
                            analysis += `**Prediction:** The stock price may decrease due to negative momentum and sentiment.`;
                        } else {
                            analysis += `**Prediction:** The stock price might remain stable or move unpredictably due to mixed indicators.`;
                        }

                        await e.data.agent.monologue(analysis);
                    } catch (error) {
                        console.error('Error in analyzing stock:', error.message);
                        await e.data.agent.monologue('Failed to analyze stock. Please try again later.');
                    }
                    await e.commit();
                }}
            />

            {/* Action that performs all steps in one go */}
            <Action
                name="fullAnalysis"
                description="Perform a full analysis by fetching sentiment, stock prices, calculating indicators, and providing a prediction"
                schema={z.object({
                    ticker: z.string(),
                })}
                handler={async (e) => {
                    const { ticker } = e.data.message.args;

                    // Reuse the analyzeStock action logic
                    await e.performAction('analyzeStock', { ticker });
                    await e.commit();
                }}
            />

            {/*<Action
                name="recommendStock"
                description="Recommend stocks based on top-mentioned tickers, positive sentiment, and technical indicators"
                schema={z.object({
                    days: z.number().optional(), // Number of days to look back, optional parameter
                })}
                handler={async (e) => {
                    let { days = 7 } = e.data.message.args; // Default to 7 if not provided

                    // Validate 'days' to be between 1 and 30
                    if (days < 1) days = 1;
                    if (days > 30) days = 30;

                    try {
                        // Fetch top-mentioned stocks
                        const topMentionedData = await fetchTopMentionedStocks(days);
                        const topTickersData = topMentionedData.data.all; // Access the correct data path

                        if (!topTickersData || topTickersData.length === 0) {
                            await e.data.agent.monologue('No top-mentioned stocks found.');
                            await e.commit();
                            return;
                        }

                        // Get top 5 tickers
                        const topTickers = topTickersData.slice(0, 5);

                        let recommendations = [];

                        for (const tickerData of topTickers) {
                            const tickerSymbol = tickerData.ticker;

                            try {
                                // Fetch sentiment data using fetchNews
                                const sentimentData = await fetchNews(tickerSymbol);

                                // Check if sentiment data is available
                                if (
                                    sentimentData &&
                                    sentimentData.total &&
                                    sentimentData.total[tickerSymbol.toUpperCase()]
                                ) {
                                    const sentimentScore =
                                        sentimentData.total[tickerSymbol.toUpperCase()]['Sentiment Score'];

                                    // If sentiment is positive, proceed
                                    if (sentimentScore > 0) {
                                        // Fetch stock prices
                                        const today = new Date();
                                        const thirtyDaysAgo = new Date(today);
                                        thirtyDaysAgo.setDate(today.getDate() - 60); // Use 60 days to ensure enough data for indicators

                                        const startDate = thirtyDaysAgo.toISOString().split('T')[0];
                                        const endDate = today.toISOString().split('T')[0];

                                        const priceDataResponse = await fetchStockPrices(
                                            tickerSymbol,
                                            startDate,
                                            endDate
                                        );
                                        const priceData = priceDataResponse.results;

                                        if (priceData && priceData.length >= 26) {
                                            // Calculate indicators
                                            const movingAverage = calculateMovingAverage(priceData, 10);
                                            const macd = calculateMACD(priceData);

                                            // Ensure we have enough data points
                                            if (movingAverage.length > 0 && macd.length > 0) {
                                                // Get the latest data point
                                                const latestPrice = priceData[priceData.length - 1].c;
                                                const latestMA = movingAverage[movingAverage.length - 1].average;
                                                const latestMACD = macd[macd.length - 1].macd;

                                                // Simple buy signal
                                                if (latestPrice > latestMA && latestMACD > 0) {
                                                    recommendations.push({
                                                        ticker: tickerSymbol,
                                                        sentimentScore,
                                                        latestPrice: latestPrice.toFixed(2),
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (innerError) {
                                console.error(`Error processing ticker ${tickerSymbol}:`, innerError.message);
                            }
                        }

                        if (recommendations.length > 0) {
                            let message = `Based on the top-mentioned stocks over the last ${days} days, here are some recommendations:\n\n`;
                            recommendations.forEach((rec) => {
                                message += `- ${rec.ticker}: Current Price $${rec.latestPrice}, Sentiment Score ${rec.sentimentScore}\n`;
                            });
                            await e.data.agent.monologue(message);
                        } else {
                            await e.data.agent.monologue('No suitable stock recommendations found based on the criteria.');
                        }
                    } catch (error) {
                        console.error('Error in recommending stock:', error.message);
                        await e.data.agent.monologue('Failed to recommend stocks. Please try again later.');
                    }

                    await e.commit();
                }}
            />
*/}

        </Agent>
    );
}
