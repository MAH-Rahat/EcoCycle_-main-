import mongoose from 'mongoose';

const ecoPointsTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['earned', 'spent', 'bonus', 'penalty'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // Can reference waste log, pickup, or reward redemption
    },
    relatedType: {
        type: String,
        enum: ['waste', 'pickup', 'reward', 'challenge', 'milestone'],
        required: false
    }
}, {
    timestamps: true
});

const ecoPointsWalletSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [ecoPointsTransactionSchema]
}, {
    timestamps: true
});

// Method to add points (earned, bonus)
ecoPointsWalletSchema.methods.addPoints = function(amount, description, relatedId = null, relatedType = null) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    this.balance += amount;
    this.totalEarned += amount;
    
    this.transactions.push({
        type: 'earned',
        amount,
        description,
        relatedId,
        relatedType
    });
    
    return this.save();
};

// Method to spend points
ecoPointsWalletSchema.methods.spendPoints = function(amount, description, relatedId = null, relatedType = null) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    if (this.balance < amount) {
        throw new Error('Insufficient balance');
    }
    
    this.balance -= amount;
    this.totalSpent += amount;
    
    this.transactions.push({
        type: 'spent',
        amount,
        description,
        relatedId,
        relatedType
    });
    
    return this.save();
};

// Method to add bonus points
ecoPointsWalletSchema.methods.addBonus = function(amount, description, relatedId = null, relatedType = null) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    this.balance += amount;
    this.totalEarned += amount;
    
    this.transactions.push({
        type: 'bonus',
        amount,
        description,
        relatedId,
        relatedType
    });
    
    return this.save();
};

// Method to apply penalty (deduct points)
ecoPointsWalletSchema.methods.applyPenalty = function(amount, description, relatedId = null, relatedType = null) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    // Don't let balance go negative
    const deductAmount = Math.min(amount, this.balance);
    this.balance -= deductAmount;
    
    this.transactions.push({
        type: 'penalty',
        amount: deductAmount,
        description,
        relatedId,
        relatedType
    });
    
    return this.save();
};

// Static method to get or create wallet for a citizen
ecoPointsWalletSchema.statics.getOrCreateWallet = async function(citizenId) {
    let wallet = await this.findOne({ citizenId });
    
    if (!wallet) {
        wallet = new this({ citizenId });
        await wallet.save();
    }
    
    return wallet;
};

const EcoPointsWallet = mongoose.model('EcoPointsWallet', ecoPointsWalletSchema);
export default EcoPointsWallet;