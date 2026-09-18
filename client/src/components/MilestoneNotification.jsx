import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MilestoneNotification = ({ milestone, onClose, isVisible }) => {
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShowConfetti(true);
            // Auto-close after 5 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    if (!milestone) return null;

    const getRarityColors = (rarity) => {
        switch (rarity) {
            case 'legendary':
                return {
                    bg: 'from-yellow-400 via-yellow-500 to-yellow-600',
                    border: 'border-yellow-300',
                    text: 'text-yellow-900',
                    glow: 'shadow-yellow-500/50'
                };
            case 'epic':
                return {
                    bg: 'from-purple-400 via-purple-500 to-purple-600',
                    border: 'border-purple-300',
                    text: 'text-purple-900',
                    glow: 'shadow-purple-500/50'
                };
            case 'rare':
                return {
                    bg: 'from-blue-400 via-blue-500 to-blue-600',
                    border: 'border-blue-300',
                    text: 'text-blue-900',
                    glow: 'shadow-blue-500/50'
                };
            default:
                return {
                    bg: 'from-green-400 via-green-500 to-green-600',
                    border: 'border-green-300',
                    text: 'text-green-900',
                    glow: 'shadow-green-500/50'
                };
        }
    };

    const colors = getRarityColors(milestone.rarity);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -50 }}
                    transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20,
                        duration: 0.6
                    }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ rotateY: -90 }}
                        animate={{ rotateY: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className={`relative max-w-md w-full bg-gradient-to-br ${colors.bg} ${colors.border} border-2 rounded-2xl p-8 text-center shadow-2xl ${colors.glow}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Confetti Effect */}
                        {showConfetti && (
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ 
                                            opacity: 1, 
                                            y: 0, 
                                            x: Math.random() * 300 - 150,
                                            rotate: 0 
                                        }}
                                        animate={{ 
                                            opacity: 0, 
                                            y: -200, 
                                            rotate: 360 
                                        }}
                                        transition={{ 
                                            duration: 2, 
                                            delay: Math.random() * 0.5,
                                            ease: "easeOut"
                                        }}
                                        className={`absolute top-full w-2 h-2 ${
                                            i % 4 === 0 ? 'bg-yellow-300' :
                                            i % 4 === 1 ? 'bg-pink-300' :
                                            i % 4 === 2 ? 'bg-blue-300' : 'bg-green-300'
                                        } rounded-full`}
                                        style={{
                                            left: `${Math.random() * 100}%`
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Achievement Content */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        >
                            <div className="text-6xl mb-4">
                                {milestone.icon}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">
                                🎉 Milestone Achieved!
                            </h2>
                            <h3 className="text-xl font-semibold text-white mb-3">
                                {milestone.name}
                            </h3>
                            <p className="text-white text-opacity-90 mb-4">
                                {milestone.description}
                            </p>
                            
                            {/* Rarity Badge */}
                            <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 rounded-full mb-4">
                                <span className="text-white font-bold text-sm uppercase tracking-wide">
                                    {milestone.rarity} Achievement
                                </span>
                            </div>

                            {/* Bonus Points */}
                            {milestone.bonusPoints && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.7, type: "spring" }}
                                    className="bg-white bg-opacity-20 rounded-lg p-3 mb-4"
                                >
                                    <div className="text-white font-semibold">
                                        Bonus Reward: +{milestone.bonusPoints} EcoPoints!
                                    </div>
                                </motion.div>
                            )}

                            {/* Milestone Value */}
                            {milestone.value && (
                                <div className="text-white text-opacity-80 text-sm mb-4">
                                    {milestone.type === 'weight' && `${milestone.value}kg recycled`}
                                    {milestone.type === 'pickups' && `${milestone.value} pickups completed`}
                                    {milestone.type === 'streak' && `${milestone.value} day streak`}
                                    {milestone.type === 'co2' && `${milestone.value}kg CO₂ saved`}
                                </div>
                            )}
                        </motion.div>

                        {/* Action Button */}
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            onClick={onClose}
                            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 backdrop-blur-sm"
                        >
                            Continue Recycling! 🌱
                        </motion.button>

                        {/* Sparkle Effects */}
                        <div className="absolute inset-0 pointer-events-none">
                            {[...Array(8)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ 
                                        opacity: [0, 1, 0], 
                                        scale: [0, 1, 0],
                                        rotate: [0, 180, 360]
                                    }}
                                    transition={{ 
                                        duration: 2, 
                                        delay: Math.random() * 1,
                                        repeat: Infinity,
                                        repeatDelay: Math.random() * 2
                                    }}
                                    className="absolute text-white text-opacity-60"
                                    style={{
                                        top: `${Math.random() * 80 + 10}%`,
                                        left: `${Math.random() * 80 + 10}%`,
                                        fontSize: `${Math.random() * 10 + 10}px`
                                    }}
                                >
                                    ✨
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MilestoneNotification;