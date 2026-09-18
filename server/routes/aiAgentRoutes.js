import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import WasteLog from '../models/Waste.js'; // Adjusted to match your project's existing model path
import User from '../models/User.js';

const router = express.Router();

// 1. Define the tools the agent is allowed to call
const tools = [{
    functionDeclarations: [
        {
            name: 'logWasteItem',
            description: 'Log a waste item the user says they are disposing of into the database and award eco points',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, description: 'Plastic, Paper, Organic, Metal, E-Waste, or Textiles' },
                    itemName: { type: Type.STRING, description: 'The specific name of the item being thrown away' },
                    weight: { type: Type.NUMBER, description: 'Estimated weight in kg, default to 1 if unknown' }
                },
                required: ['category', 'itemName']
            }
        },
        {
            name: 'getUserEcoPoints',
            description: "Get the user's current eco-points balance from their account profile",
            parameters: { type: Type.OBJECT, properties: {} }
        }
    ]
}];

// 2. Real database execution functions ("the hands")
async function logWasteItem(userId, { category, itemName, weight = 1 }) {
    try {
        const numericWeight = Number(weight) || 1;
        const pointsEarned = numericWeight * 10; // 10 points per kg

        // Create the waste log record matching your project schema
        const log = await WasteLog.create({
            citizenId: userId,
            wasteType: category,
            material: itemName,
            weight: numericWeight,
            pickupStatus: 'Logged'
        });

        // Increment user's eco-points
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { $inc: { points: pointsEarned } },
            { new: true }
        );

        return { 
            success: true, 
            category, 
            itemName, 
            weight: numericWeight, 
            pointsEarned,
            totalPoints: updatedUser?.points ?? 0 
        };
    } catch (err) {
        console.error("Tool Execution Error (logWasteItem):", err);
        return { success: false, error: err.message };
    }
}

async function getUserEcoPoints(userId) {
    try {
        const user = await User.findById(userId).select('points name');
        return { 
            success: true, 
            userName: user?.name || 'User',
            ecoPoints: user?.points ?? 0 
        };
    } catch (err) {
        console.error("Tool Execution Error (getUserEcoPoints):", err);
        return { ecoPoints: 0 };
    }
}

// 3. Agent Main Endpoint
router.post('/query', async (req, res) => {
    try {
        const { message, userId } = req.body; 
        
        if (!message) {
            return res.status(400).json({ success: false, message: "Message is required" });
        }
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session identifier (userId) is required for agent tools." });
        }

        const systemInstruction = `You are EcoCycle AI, an active autonomous agent for a sustainable waste-management platform in Bangladesh. 
        - Keep final responses concise (1-2 sentences).
        - Guide users on waste categories (Plastic, Paper, Organic, Metal, E-Waste, Textiles).
        - You have access to tools. ALWAYS invoke 'logWasteItem' when the user wants to log, dispose, or throw away waste. ALWAYS invoke 'getUserEcoPoints' when they ask about their points balance.`;

        const ai = new GoogleGenAI();

        // First turn — model analyzes input and decides if a tool call is needed
        let response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', // Highly stable production model for agent reasoning
            contents: message,
            config: { systemInstruction, tools }
        });

        const call = response.functionCalls?.[0];

        if (call) {
            // Execute the requested tool
            let toolResult;
            if (call.name === 'logWasteItem') {
                toolResult = await logWasteItem(userId, call.args);
            } else if (call.name === 'getUserEcoPoints') {
                toolResult = await getUserEcoPoints(userId);
            }

            // Second turn — send function execution output back to Gemini so it can craft a natural response
            response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: message }] },
                    { role: 'model', parts: [{ functionCall: call }] },
                    { 
                        role: 'function', 
                        parts: [{ 
                            functionResponse: { 
                                name: call.name, 
                                response: { output: toolResult } 
                            } 
                        }] 
                    }
                ],
                config: { systemInstruction, tools }
            });
        }

        res.status(200).json({ 
            success: true, 
            reply: response.text || "I have successfully processed your request!" 
        });

    } catch (error) {
        console.error("--- AI AGENT ERROR ---", error);
        res.status(500).json({ 
            success: false, 
            message: "AI agent service is currently unavailable.", 
            error: error.message 
        });
    }
});

export default router