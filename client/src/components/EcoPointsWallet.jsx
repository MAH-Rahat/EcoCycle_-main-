import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socketService from '../services/socketService.js';

const EcoPointsWallet = ({ userId }) => {
    const [wallet, setWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        fetchWallet();
        setupSocketConnection();
        
        return () => {
            // Cleanup socket listeners
            socketService.off('walletUpdated', handleWalletUpdate);
            socketService.off('newTransaction', handleNewTransaction);
            socketService.unsubscribeFromWallet();
        };
    }, [userId]);

    const setupSocketConnection = () => {
        const token = localStorage.getItem('token');
        
        if (token && !socketService.isSocketConnected()) {
            socketService.connect(token);
        }

        // Subscribe to wallet updates
        socketService.subscribeToWallet();
        
        // Set up event listeners
        socketService.on('walletUpdated', handleWalletUpdate);
        socketService.on('newTransaction', handleNewTransaction);
        
        setIsConnected(socketService.isSocketConnected());
    };

    const handleWalletUpdate = (updatedWallet) => {
        console.log('Wallet updated:', updatedWallet);
        setWallet(prevWallet => ({
            ...prevWallet,
            ...updatedWallet
        }));
    };

    const handleNewTransaction = (transaction) => {
        console.log('New transaction:', transaction);
        setWallet(prevWallet => {
            if (!prevWallet) return prevWallet;
            
            return {
                ...prevWallet,
                recentTransactions: [transaction, ...prevWallet.recentTransactions.slice(0, 19)]
            };
        });
        
        // Show notification
        showTransactionNotification(transaction);
    };

    const showTransactionNotification = (transaction) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const isPositive = transaction.type === 'earned' || transaction.type === 'bonus';
            new Notification(
                isPositive ? 'EcoPoints Earned!' : 'EcoPoints Spent',
                {
                    body: transaction.description,
                    icon: '/favicon.ico'
                }
            );
        }
    };

    const fetchWallet = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/ecopoints/wallet', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            if (response.data.success) {
                setWallet(response.data.data);
            } else {
                setError('Failed to load wallet');
            }
        } catch (err) {
            console.error('Wallet fetch error:', err);
            setError(err.response?.data?.message || 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    };

    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'earned':
                return '🌱';
            case 'bonus':
                return '🎁';
            case 'spent':
                return '🛍️';
            case 'penalty':
                return '⚠️';
            default:
                return '💰';
        }
    };

    const getTransactionColor = (type) => {
        switch (type) {
            case 'earned':
            case 'bonus':
                return 'text-green-600';
            case 'spent':
            case 'penalty':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-red-600">
                    <p className="text-lg font-semibold">Error Loading Wallet</p>
                    <p className="text-sm mt-2">{error}</p>
                    <button 
                        onClick={fetchWallet}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold text-gray-800">EcoPoints Wallet</h2>
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-600">
                            {isConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Current Balance</p>
                        <p className="text-2xl font-bold text-green-700">{wallet?.balance || 0}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">Total Earned</p>
                        <p className="text-2xl font-bold text-blue-700">{wallet?.totalEarned || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">Total Spent</p>
                        <p className="text-2xl font-bold text-purple-700">{wallet?.totalSpent || 0}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Transactions</h3>
                {wallet?.recentTransactions && wallet.recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                        {wallet.recentTransactions.map((transaction, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                                    <div>
                                        <p className="font-medium text-gray-800">{transaction.description}</p>
                                        <p className="text-sm text-gray-500">{formatDate(transaction.createdAt)}</p>
                                    </div>
                                </div>
                                <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                                    {transaction.type === 'spent' || transaction.type === 'penalty' ? '-' : '+'}
                                    {transaction.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <p className="text-lg">No transactions yet</p>
                        <p className="text-sm">Start logging waste to earn EcoPoints!</p>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-center space-x-4">
                <button 
                    onClick={fetchWallet}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                    Refresh Wallet
                </button>
                <button 
                    onClick={requestNotificationPermission}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                    Enable Notifications
                </button>
            </div>
        </div>
    );
};

export default EcoPointsWallet;