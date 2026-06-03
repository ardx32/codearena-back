import express from 'express';
import Problem from '../models/Problem.js';
import Groq from 'groq-sdk';

const router = express.Router();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Explain the problem in easy terms using Groq AI
// @route   GET /api/explain/:problemId
// @access  Public
router.get('/:problemId', async (req, res) => {
    try {
        const { problemId } = req.params;

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'Groq API Key is missing on the server.' });
        }

        // Fetch the problem
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found.' });
        }

        // Formulate prompt
        const prompt = `You are an expert programming mentor. A student is struggling to understand this coding problem.
        
Problem Title: ${problem.title}
Problem Description: ${problem.description}

Please explain this problem in VERY simple, easy-to-understand terms. Use analogies if it helps. Describe what the input is, what the output should be, and give a hint on how to approach it without giving away the exact code solution. Use markdown for formatting. Keep it concise but illuminating.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a warm, encouraging, and highly effective programming mentor explaining concepts simply.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            max_completion_tokens: 600,
        });

        const explanation = chatCompletion.choices[0]?.message?.content;

        return res.status(200).json({ explanation });

    } catch (error) {
        console.error("Explanation Error:", error);
        res.status(500).json({ error: 'Server Error during explanation generation.' });
    }
});

export default router;
