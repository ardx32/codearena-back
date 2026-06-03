import express from 'express';
import Groq from 'groq-sdk';

const router = express.Router();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Generate a personalized learning roadmap using Groq AI
// @route   POST /api/roadmap/generate
// @access  Public
router.post('/generate', async (req, res) => {
    try {
        const { goal, experience, timeCommitment } = req.body;

        if (!goal || !experience || !timeCommitment) {
            return res.status(400).json({ error: 'Please provide goal, experience, and timeCommitment.' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'Groq API Key is missing on the server.' });
        }

        const prompt = `Generate a concise, week-by-week DSA learning roadmap (8-12 weeks).

Student details:
- Goal: ${goal}
- Level: ${experience}
- Daily time: ${timeCommitment}

Rules:
- Be concise. Use short bullet points only. No paragraphs, no motivational text, no extra tips or suggestions.
- Only mention "Code Arena" as the practice platform. Do NOT mention LeetCode, Codeforces, GeeksforGeeks, HackerRank, or any other platform.
- Each week should list: topics to study and problems to practice on Code Arena.
- No "Pro Tips", no "Recommended Platforms" section, no feedback. Just the roadmap.

Format in Markdown with headers and bullet points.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a concise DSA mentor. Give short, point-based roadmaps with no fluff. Only mention Code Arena as the practice platform.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            max_completion_tokens: 1500,
        });

        const roadmap = chatCompletion.choices[0]?.message?.content;

        return res.status(200).json({ roadmap });

    } catch (error) {
        console.error("Roadmap Generation Error:", error);
        res.status(500).json({ error: 'Server Error during roadmap generation.' });
    }
});

export default router;
