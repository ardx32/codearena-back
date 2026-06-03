import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema({
    problemNumber: {
        type: Number,
        unique: true,
        sparse: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium',
    },
    category: {
        type: String,
        required: true,
    },
    tags: [{
        type: String,
    }],
    testCases: [{
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        isHidden: { type: Boolean, default: false } // Hidden test cases for evaluation
    }],
    timeLimit: {
        type: Number,
        default: 0 // 0 means no limit (global contest timer relies on contest end time instead)
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // If created by a company
        default: null
    },
    isMock: {
        type: Boolean,
        default: false // True for practice categorized problems
    }
}, { timestamps: true });

const Problem = mongoose.model('Problem', problemSchema);
export default Problem;
