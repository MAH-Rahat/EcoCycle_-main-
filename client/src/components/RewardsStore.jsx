import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socketService from '../services/socketService.js';

const RewardsStore = ({ userBalance = 0 }) => {
    const [rewards, setRewards] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('priority');
    const [selectedReward, setSelectedReward] = useState(null);
    const [showRedemptionModal, setShowRedemptionModal] = useState(false);
    const [redemptionLoading, setRedemptionLoading] = useState(false);
    const [userRedemptions, setUserRedemptions] = useState([]);

    useEffect(() => {
        fetchRewards();
        fetchCategories();
        fetchUserRedemptions();
    }, [selectedCategory, searchTerm, sortBy]);

    const fetchRewards = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedCategory) params.append('category', selectedCategory);
            if (searchTerm) params.append('search', searchTerm);
            if (sortBy) params.append('sortBy', sortBy);

            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/rewards?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setRewards(response.data.data.rewards);
            }
        } catch (err) {
            console.error('Fetch rewards error:', err);
            setError('Failed to load rewards');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/rewards/categories', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setCategories(response.data.data);
            }
        } catch (err) {
            console.error('Fetch categories error:', err);
        }
    };

    const fetchUserRedemptions = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/rewards/my-redemptions', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setUserRedemptions(response.data.data.redemptions);
            }
        } catch (err) {
            console.error('Fetch user redemptions error:', err);
        }
    };

    const handleRedeemReward = async (reward) => {
        setSelectedReward(reward);
        setShowRedemptionModal(true);
    };

    const confirmRedemption = async (deliveryInfo) => {
        try {
            setRedemptionLoading(true);
            const token = localStorage.getItem('token');
            
            const response = await axios.post(
                `/api/rewards/${selectedReward._id}/redeem`,
                deliveryInfo,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setShowRedemptionModal(false);
                setSelectedReward(null);
                
                // Show success message
                alert(`Reward redeemed successfully! Your redemption code is: ${response.data.data.redemptionCode}`);
                
                // Refresh data
                fetchRewards();
                fetchUserRedemptions();
            }
        } catch (err) {
            console.error('Redeem reward error:', err);
            alert(err.response?.data?.message || 'Failed to redeem reward');
        } finally {
            setRedemptionLoading(false);
        }
    };

    const getCategoryIcon = (category) => {
        const icons = {
            vouchers: '🎫',
            products: '📦',
            experiences: '🎯',
            donations: '🌱',
            discounts: '💰'
        };
        return icons[category] || '🎁';
    };

    const formatCategory = (category) => {
        return category.charAt(0).toUpperCase() + category.slice(1);
    };

    const canAfford = (pointsCost) => {
        return userBalance >= pointsCost;
    };

    if (loading && rewards.length === 0) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-lg shadow-md p-6">
                                <div className="h-48 bg-gray-200 rounded mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Rewards Store</h1>
                <p className="text-gray-600">
                    Your EcoPoints Balance: <span className="font-bold text-green-600">{userBalance}</span>
                </p>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search Rewards
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search for rewards..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat.category} value={cat.category}>
                                    {getCategoryIcon(cat.category)} {formatCategory(cat.category)} ({cat.count})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sort By
                        </label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="priority">Featured</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="newest">Newest First</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Rewards Grid */}
            {error ? (
                <div className="text-center py-8">
                    <p className="text-red-600 text-lg">{error}</p>
                    <button
                        onClick={fetchRewards}
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                        Retry
                    </button>
                </div>
            ) : rewards.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-600 text-lg">No rewards found</p>
                    <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rewards.map((reward) => (
                        <div key={reward._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <img
                                src={reward.image}
                                alt={reward.name}
                                className="w-full h-48 object-cover"
                            />
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-500">
                                        {getCategoryIcon(reward.category)} {formatCategory(reward.category)}
                                    </span>
                                    {reward.stock !== null && (
                                        <span className="text-sm text-gray-500">
                                            Stock: {reward.stock}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                    {reward.name}
                                </h3>
                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                                    {reward.description}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-2xl font-bold text-green-600">
                                            {reward.pointsCost}
                                        </span>
                                        <span className="text-sm text-gray-500 ml-1">points</span>
                                    </div>
                                    <button
                                        onClick={() => handleRedeemReward(reward)}
                                        disabled={!canAfford(reward.pointsCost) || !reward.isAvailable}
                                        className={`px-4 py-2 rounded font-medium transition-colors ${
                                            canAfford(reward.pointsCost) && reward.isAvailable
                                                ? 'bg-green-500 text-white hover:bg-green-600'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {!canAfford(reward.pointsCost) ? 'Insufficient Points' : 'Redeem'}
                                    </button>
                                </div>
                                {reward.partnerId && (
                                    <div className="mt-3 text-xs text-gray-500">
                                        Partner: {reward.partnerId.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Redemption Modal */}
            {showRedemptionModal && selectedReward && (
                <RedemptionModal
                    reward={selectedReward}
                    onConfirm={confirmRedemption}
                    onCancel={() => {
                        setShowRedemptionModal(false);
                        setSelectedReward(null);
                    }}
                    loading={redemptionLoading}
                />
            )}
        </div>
    );
};

// Redemption Modal Component
const RedemptionModal = ({ reward, onConfirm, onCancel, loading }) => {
    const [deliveryInfo, setDeliveryInfo] = useState({
        deliveryAddress: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'USA'
        },
        contactInfo: {
            email: '',
            phone: ''
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(deliveryInfo);
    };

    const needsDeliveryInfo = reward.category === 'products';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Confirm Redemption</h2>
                
                <div className="mb-4">
                    <img
                        src={reward.image}
                        alt={reward.name}
                        className="w-full h-32 object-cover rounded mb-2"
                    />
                    <h3 className="font-semibold">{reward.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{reward.description}</p>
                    <p className="text-lg font-bold text-green-600">
                        Cost: {reward.pointsCost} EcoPoints
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {needsDeliveryInfo && (
                        <div className="mb-4">
                            <h4 className="font-medium mb-2">Delivery Information</h4>
                            <div className="space-y-2">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    required
                                    value={deliveryInfo.contactInfo.email}
                                    onChange={(e) => setDeliveryInfo({
                                        ...deliveryInfo,
                                        contactInfo: { ...deliveryInfo.contactInfo, email: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Street Address"
                                    required
                                    value={deliveryInfo.deliveryAddress.street}
                                    onChange={(e) => setDeliveryInfo({
                                        ...deliveryInfo,
                                        deliveryAddress: { ...deliveryInfo.deliveryAddress, street: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="City"
                                        required
                                        value={deliveryInfo.deliveryAddress.city}
                                        onChange={(e) => setDeliveryInfo({
                                            ...deliveryInfo,
                                            deliveryAddress: { ...deliveryInfo.deliveryAddress, city: e.target.value }
                                        })}
                                        className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="ZIP Code"
                                        required
                                        value={deliveryInfo.deliveryAddress.zipCode}
                                        onChange={(e) => setDeliveryInfo({
                                            ...deliveryInfo,
                                            deliveryAddress: { ...deliveryInfo.deliveryAddress, zipCode: e.target.value }
                                        })}
                                        className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex space-x-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Confirm Redemption'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RewardsStore;