import express from 'express';
import Contest from '../models/Contest.js';
import Problem from '../models/Problem.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all active/upcoming contests
// @route   GET /api/contests
// @access  Public
router.get('/', async (req, res) => {
    try {
        const contests = await Contest.find().populate('companyId', 'name').sort({ startTime: 1 });
        res.status(200).json(contests);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching contests' });
    }
});

// @desc    Get single contest by ID
// @route   GET /api/contests/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.id)
            .populate('companyId', 'name')
            .populate('problems', 'title difficulty category timeLimit');

        if (!contest) return res.status(404).json({ message: 'Contest not found' });
        res.status(200).json(contest);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching contest' });
    }
});

// @desc    Create a modern contest (Company Only)
// @route   POST /api/contests
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.preference !== 'company') {
            return res.status(403).json({ message: 'Only companies can create contests' });
        }

        const { title, description, problems, startTime, endTime, strictValidation } = req.body;

        // problems is now an array of complete Problem objects containing Title, Desc, TimeLimit, TestCases
        const createdProblemIds = [];
        for (const probData of problems) {
            const newProblem = new Problem({
                title: probData.title,
                description: probData.description,
                difficulty: probData.difficulty || 'Medium',
                category: probData.category || 'Contest Specific',
                testCases: probData.testCases,
                timeLimit: probData.timeLimit || 0,
                companyId: req.user._id,
                isMock: false
            });
            const savedProb = await newProblem.save();
            createdProblemIds.push(savedProb._id);
        }

        const contest = new Contest({
            title,
            description,
            companyId: req.user._id,
            problems: createdProblemIds,
            startTime,
            endTime,
            strictValidation
        });

        const createdContest = await contest.save();
        res.status(201).json(createdContest);
    } catch (error) {
        res.status(500).json({ message: 'Server Error creating contest', error: error.message });
    }
});

// @desc    Register for a contest
// @route   POST /api/contests/:id/register
// @access  Private
router.post('/:id/register', protect, async (req, res) => {
    try {
        const contest = await Contest.findById(req.params.id);
        if (!contest) return res.status(404).json({ message: 'Contest not found' });

        // Check if contest already ended
        if (new Date() > new Date(contest.endTime)) {
            return res.status(400).json({ message: 'Contest has already ended' });
        }

        // Check if user already registered
        if (contest.participants.includes(req.user._id)) {
            return res.status(400).json({ message: 'You are already registered for this contest' });
        }

        contest.participants.push(req.user._id);
        await contest.save();

        res.status(200).json({ message: 'Successfully registered for the contest!' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error during registration' });
    }
});

export default router;
