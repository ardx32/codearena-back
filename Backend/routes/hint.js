import express from 'express';
import Problem from '../models/Problem.js';
import Groq from 'groq-sdk';

const router = express.Router();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Get a hint for the problem using Groq AI
// @route   GET /api/hint/:problemId
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
        const prompt = `You are a helpful programming bot named "Arena Bot". A user has made multiple wrong attempts on the following problem and needs a hint.
        
Problem Title: ${problem.title}
Problem Description: ${problem.description}

Provide a short, direct hint. DO NOT give away the exact code or the full solution. Focus on pointing them in the right direction (e.g., suggesting a data structure, an algorithmic approach like two-pointers, or a small logical leap). Keep it under 3 sentences. Use markdown for formatting.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are "Arena Bot", an AI programming assistant that provides concise, guiding hints without spoiling the solution.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.6,
            max_completion_tokens: 300,
        });

        const hint = chatCompletion.choices[0]?.message?.content;

        return res.status(200).json({ hint });

    } catch (error) {
        console.error("Hint Error:", error);
        res.status(500).json({ error: 'Server Error during hint generation.' });
    }
});

export default router;
