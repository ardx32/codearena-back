import express from 'express';
import Problem from '../models/Problem.js';
import Groq from 'groq-sdk';

const router = express.Router();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Get the editorial/solution for the problem using Groq AI
// @route   GET /api/editorial/:problemId
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
        const prompt = `You are a Principal Software Engineer writing an official editorial solution for a coding problem.

Problem Title: ${problem.title}
Problem Description: ${problem.description}

Please write a comprehensive editorial. It should include:
1. **Intuition**: A high-level explanation of the optimal approach.
2. **Algorithm**: Step-by-step logic.
3. **Complexity**: Time and Space complexity analysis.
4. **Code Structure**: An optimal C++ or Python code snippet.

Use markdown for formatting. Keep it highly professional, clean, and educational.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert algorithms instructor and software engineering author writing clear, optimal coding editorials.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_completion_tokens: 1500,
        });

        const editorial = chatCompletion.choices[0]?.message?.content;

        return res.status(200).json({ editorial });

    } catch (error) {
        console.error("Editorial Error:", error);
        res.status(500).json({ error: 'Server Error during editorial generation.' });
    }
});

export default router;
