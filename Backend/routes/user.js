import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import Submission from '../models/Submission.js';
import Problem from '../models/Problem.js';

const router = express.Router();

// @desc    Get user profile data
// @route   GET /api/user/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
    try {
        // req.user is already populated by the protect middleware
        if (req.user) {
            res.status(200).json({
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                preference: req.user.preference,
                bio: req.user.bio,
                location: req.user.location,
                github: req.user.github,
                role: req.user.role,
                rating: req.user.rating,
                createdAt: req.user.createdAt
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
});

// @desc    Get aggregated user profile statistics
// @route   GET /api/user/profile/stats
// @access  Private
router.get('/profile/stats', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const submissions = await Submission.find({ user: userId })
            .populate('problem', 'title difficulty category')
            .sort({ createdAt: -1 });

        const solvedProblems = new Set();
        const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
        const languageCounts = {};
        const heatmapMap = {};

        submissions.forEach(sub => {
            // Count language usage (only for accepted runs or all runs? Let's do all runs for more data)
            const lang = sub.language || 'Auto';
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;

            // Date for heatmap (YYYY-MM-DD)
            const dateObj = new Date(sub.createdAt);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            heatmapMap[dateStr] = (heatmapMap[dateStr] || 0) + 1;

            // Count unique accepted problems for difficulty & total solved
            if (sub.status === 'Accepted' && sub.problem) {
                const probId = sub.problem._id.toString();
                if (!solvedProblems.has(probId)) {
                    solvedProblems.add(probId);
                    const diff = sub.problem.difficulty;
                    if (difficultyCounts[diff] !== undefined) {
                        difficultyCounts[diff]++;
                    }
                }
            }
        });

        // ---------------------------------
        // Streak Calculations
        // ---------------------------------
        const dateKeys = Object.keys(heatmapMap).sort();
        let currentStreak = 0;
        let maxStreak = 0;

        if (dateKeys.length > 0) {
            let tempStreak = 1;
            maxStreak = 1;
            // Max Streak
            for (let i = 1; i < dateKeys.length; i++) {
                const prevDate = new Date(dateKeys[i - 1]);
                const currDate = new Date(dateKeys[i]);
                const diffTime = Math.abs(currDate - prevDate);
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    tempStreak++;
                    maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                    tempStreak = 1;
                }
            }

            // Current Streak
            const todayDateObj = new Date();
            const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
            const yesterdayDateObj = new Date();
            yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
            const yesterdayStr = `${yesterdayDateObj.getFullYear()}-${String(yesterdayDateObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDateObj.getDate()).padStart(2, '0')}`;

            let activeDateForStreak = null;
            if (heatmapMap[todayStr]) activeDateForStreak = new Date(todayDateObj);
            else if (heatmapMap[yesterdayStr]) activeDateForStreak = new Date(yesterdayDateObj);

            if (activeDateForStreak) {
                let streak = 0;
                let checkDate = activeDateForStreak;
                while (true) {
                    let cStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                    if (heatmapMap[cStr]) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
                currentStreak = streak;
            }
        }

        // Format recent submissions
        const recentSubmissions = submissions.slice(0, 10).map(sub => ({
            _id: sub._id,
            problemTitle: sub.problem ? sub.problem.title : 'Unknown Problem',
            category: sub.problem ? sub.problem.category : 'Unknown',
            difficulty: sub.problem ? sub.problem.difficulty : 'Medium',
            language: sub.language,
            status: sub.status,
            createdAt: sub.createdAt
        }));

        res.status(200).json({
            totalSolved: solvedProblems.size,
            difficulty: difficultyCounts,
            languages: languageCounts,
            heatmap: heatmapMap,
            recentSubmissions,
            currentStreak,
            maxStreak
        });

    } catch (error) {
        console.error("Failed to fetch profile stats", error);
        res.status(500).json({ message: 'Server error fetching user stats' });
    }
});

export default router;
