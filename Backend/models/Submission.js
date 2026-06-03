import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    problem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem',
        required: true
    },
    code: {
        type: String,
        required: true
    },
    language: {
        type: String,
        default: 'Auto-Inferred'
    },
    status: {
        type: String,
        required: true,
        enum: ['Accepted', 'Wrong Answer', 'Compile Error', 'Time Limit', 'Error']
    },
    message: {
        type: String
    }
}, { timestamps: true });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
