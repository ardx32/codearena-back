import express from 'express';
import Submission from '../models/Submission.js';
import User from '../models/User.js';

const router = express.Router();

// @desc    Get global leaderboard (users ranked by problems solved)
// @route   GET /api/leaderboard
// @access  Public
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Step 1: Aggregate submissions per user
        const pipeline = [
            {
                $group: {
                    _id: '$user',
                    totalAttempts: { $sum: 1 },
                    solved: {
                        $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] }
                    },
                    wrongAnswers: {
                        $sum: { $cond: [{ $eq: ['$status', 'Wrong Answer'] }, 1, 0] }
                    },
                    lastActive: { $max: '$createdAt' }
                }
            },
            // Join with User collection
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            // Only include users with preference "user" (not companies)
            {
                $match: {
                    'userInfo.preference': { $ne: 'company' }
                }
            },
            // Project clean fields
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    name: '$userInfo.name',
                    email: '$userInfo.email',
                    location: '$userInfo.location',
                    rating: '$userInfo.rating',
                    solved: 1,
                    totalAttempts: 1,
                    wrongAnswers: 1,
                    lastActive: 1,
                    acceptRate: {
                        $cond: [
                            { $eq: ['$totalAttempts', 0] },
                            0,
                            { $round: [{ $multiply: [{ $divide: ['$solved', '$totalAttempts'] }, 100] }, 0] }
                        ]
                    }
                }
            },
            // Sort by solved DESC, then fewer attempts = better
            { $sort: { solved: -1, totalAttempts: 1, lastActive: -1 } }
        ];

        // Apply search filter if provided
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { location: { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        // Get total count before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Submission.aggregate(countPipeline);
        const totalUsers = countResult.length > 0 ? countResult[0].total : 0;

        // Apply pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        const leaderboard = await Submission.aggregate(pipeline);

        // Add rank numbers based on position
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            ...user,
            rank: skip + index + 1
        }));

        res.status(200).json({
            leaderboard: rankedLeaderboard,
            totalUsers,
            page,
            totalPages: Math.ceil(totalUsers / limit)
        });

    } catch (error) {
        console.error('Leaderboard Error:', error);
        res.status(500).json({ message: 'Server error fetching leaderboard.', error: error.message });
    }
});

export default router;
