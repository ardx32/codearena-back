import express from 'express';
import Problem from '../models/Problem.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all problems (with search, filter, sort, pagination)
// @route   GET /api/problems
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { category, isMock, search, difficulty, sortBy, order, page, limit } = req.query;
        let query = {};

        if (category && category !== 'All') query.category = category;
        if (isMock) query.isMock = isMock === 'true';
        if (difficulty && difficulty !== 'All') query.difficulty = difficulty;
        if (search) query.title = { $regex: search, $options: 'i' };

        // Sorting
        let sortObj = { problemNumber: 1 }; // default sort by problem number
        if (sortBy) {
            const sortOrder = order === 'desc' ? -1 : 1;
            if (sortBy === 'difficulty') {
                // Custom sort order for difficulty: Easy=1, Medium=2, Hard=3
                // We'll handle this in post-processing or use a simple string sort
                sortObj = { [sortBy]: sortOrder };
            } else {
                sortObj = { [sortBy]: sortOrder };
            }
        }

        // Count total matching documents
        const totalCount = await Problem.countDocuments(query);

        // Pagination
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const totalPages = Math.ceil(totalCount / limitNum);
        const skip = (pageNum - 1) * limitNum;

        const problems = await Problem.find(query)
            .select('-testCases.expectedOutput')
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum);

        res.status(200).json({
            problems,
            totalCount,
            page: pageNum,
            totalPages,
            limit: limitNum,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching problems' });
    }
});

// @desc    Get single problem by ID
// @route   GET /api/problems/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) return res.status(404).json({ message: 'Problem not found' });

        // Security: Deep clone to avoid mutating mongoose cache/doc
        const safeProblem = JSON.parse(JSON.stringify(problem));

        // Strip out expectedOutputs for hidden test cases
        if (safeProblem.testCases) {
            safeProblem.testCases = safeProblem.testCases.map(tc => {
                if (tc.isHidden) {
                    delete tc.expectedOutput;
                }
                return tc;
            });
        }

        res.status(200).json(safeProblem);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching problem' });
    }
});

// @desc    Get all problems authored by current company
// @route   GET /api/problems/me
// @access  Private (Company)
router.get('/me', protect, async (req, res) => {
    try {
        if (req.user.preference !== 'company') {
            return res.status(403).json({ message: 'Only companies can access authored problems' });
        }

        const problems = await Problem.find({ companyId: req.user._id });
        res.status(200).json(problems);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching company problems' });
    }
});

// @desc    Create a new global practice problem (Superadmin only)
// @route   POST /api/problems/superadmin
// @access  Private (Superadmin)
router.post('/superadmin', protect, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Only superadmins can create practice problems' });
        }

        const { title, description, difficulty, category, testCases } = req.body;

        const problem = new Problem({
            title,
            description,
            difficulty,
            category,
            testCases,
            isMock: true // Force it to be a global practice question
        });

        const createdProblem = await problem.save();
        res.status(201).json(createdProblem);
    } catch (error) {
        res.status(500).json({ message: 'Server Error creating superadmin problem', error: error.message });
    }
});

// @desc    Create a new problem (Company only)
// @route   POST /api/problems
// @access  Private (Company)
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.preference !== 'company') {
            return res.status(403).json({ message: 'Only companies can create problems' });
        }

        const { title, description, difficulty, category, testCases, isMock } = req.body;

        const problem = new Problem({
            title,
            description,
            difficulty,
            category,
            testCases,
            companyId: req.user._id,
            isMock: isMock || false
        });

        const createdProblem = await problem.save();
        res.status(201).json(createdProblem);
    } catch (error) {
        res.status(500).json({ message: 'Server Error creating problem', error: error.message });
    }
});

// @desc    Seed Mock Data for Practice Screen
// @route   POST /api/problems/seed
// @access  Public (Just for dev)
router.post('/seed', async (req, res) => {
    try {
        await Problem.deleteMany({ isMock: true });

        const mockProblems = [
            {
                title: "Two Sum",
                description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
                difficulty: "Easy",
                category: "Arrays",
                isMock: true,
                testCases: [
                    { input: "[2,7,11,15]\n9", expectedOutput: "[0,1]" },
                    { input: "[3,2,4]\n6", expectedOutput: "[1,2]" }
                ]
            },
            {
                title: "Maximum Subarray",
                description: "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.",
                difficulty: "Medium",
                category: "Dynamic Programming",
                isMock: true,
                testCases: [
                    { input: "[-2,1,-3,4,-1,2,1,-5,4]", expectedOutput: "6" },
                    { input: "[1]", expectedOutput: "1" }
                ]
            },
            {
                title: "Valid Parentheses",
                description: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
                difficulty: "Easy",
                category: "Stacks",
                isMock: true,
                testCases: [
                    { input: "()", expectedOutput: "true" },
                    { input: "()[]{}", expectedOutput: "true" }
                ]
            }
        ];

        await Problem.insertMany(mockProblems);
        res.status(201).json({ message: "Mock problems seeded successfully!" });
    } catch (error) {
        res.status(500).json({ message: 'Server Error seeding problems' });
    }
});

export default router;
