import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement
} from 'chart.js';
import MilestoneNotification from './MilestoneNotification';
import useMilestoneNotifications from '../hooks/useMilestoneNotifications';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement
);

const ImpactDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Milestone notifications
    const { notifications, removeNotification, simulateMilestone } = useMilestoneNotifications();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/impact/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const result = await response.json();
            setDashboardData(result.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const refreshDashboard = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/impact/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to refresh dashboard');
            }

            await fetchDashboardData();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">Error: {error}</p>
                <button 
                    onClick={fetchDashboardData}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!dashboardData) {
        return <div>No data available</div>;
    }

    const { dashboard, stats, recentAchievements } = dashboardData;

    // Prepare chart data
    const monthlyTrendsData = {
        labels: dashboard.monthlyTrends.map(trend => {
            const date = new Date(trend.month + '-01');
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }).reverse(),
        datasets: [
            {
                label: 'Weight (kg)',
                data: dashboard.monthlyTrends.map(trend => trend.weight).reverse(),
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'CO2 Saved (kg)',
                data: dashboard.monthlyTrends.map(trend => trend.co2Saved).reverse(),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }
        ]
    };

    const wasteBreakdownData = {
        labels: dashboard.wasteBreakdown.map(item => item.type),
        datasets: [{
            data: dashboard.wasteBreakdown.map(item => item.weight),
            backgroundColor: [
                '#ef4444', '#f97316', '#eab308', '#22c55e', 
                '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Monthly Impact Trends'
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Weight (kg)'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'CO2 Saved (kg)'
                },
                grid: {
                    drawOnChartArea: false,
                }
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Milestone Notifications */}
            {notifications.map(notification => (
                notification.type === 'milestone' && (
                    <MilestoneNotification
                        key={notification.id}
                        milestone={notification.data}
                        onClose={() => removeNotification(notification.id)}
                        isVisible={true}
                    />
                )
            ))}

            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Your Environmental Impact</h1>
                <div className="flex space-x-2">
                    <button
                        onClick={refreshDashboard}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Refresh Data
                    </button>
                    {/* Test milestone notification button (development only) */}
                    {process.env.NODE_ENV === 'development' && (
                        <button
                            onClick={() => simulateMilestone('weight', 10)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                        >
                            Test Milestone
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {['overview', 'trends', 'achievements'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                                activeTab === tab
                                    ? 'border-green-500 text-green-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                        <span className="text-green-600 font-bold">♻️</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500">Total Recycled</p>
                                    <p className="text-2xl font-bold text-gray-900">{dashboard.totalWasteRecycled.toFixed(1)} kg</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-bold">🌍</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500">CO2 Saved</p>
                                    <p className="text-2xl font-bold text-gray-900">{dashboard.co2Saved.toFixed(1)} kg</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                        <span className="text-yellow-600 font-bold">⭐</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500">EcoPoints</p>
                                    <p className="text-2xl font-bold text-gray-900">{dashboard.ecoPointsEarned.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                        <span className="text-purple-600 font-bold">🔥</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500">Current Streak</p>
                                    <p className="text-2xl font-bold text-gray-900">{dashboard.currentStreak} days</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Environmental Impact */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Environmental Impact Equivalents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-2xl mb-2">🌳</div>
                                <div className="text-xl font-bold text-green-600">{stats.environmentalImpact.treesEquivalent}</div>
                                <div className="text-sm text-gray-600">Trees Worth of CO2</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <div className="text-2xl mb-2">🚗</div>
                                <div className="text-xl font-bold text-blue-600">{stats.environmentalImpact.carsOffRoad}</div>
                                <div className="text-sm text-gray-600">Cars Off Road (Year)</div>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                <div className="text-2xl mb-2">⚡</div>
                                <div className="text-xl font-bold text-yellow-600">{stats.environmentalImpact.energySaved}</div>
                                <div className="text-sm text-gray-600">kWh Energy Saved</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                <div className="text-2xl mb-2">🍶</div>
                                <div className="text-xl font-bold text-purple-600">{stats.environmentalImpact.plasticBottlesSaved.toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Plastic Bottles Saved</div>
                            </div>
                        </div>
                    </div>

                    {/* Waste Breakdown */}
                    {dashboard.wasteBreakdown.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Waste Type Breakdown</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="h-64">
                                    <Doughnut 
                                        data={wasteBreakdownData} 
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'right'
                                                }
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    {dashboard.wasteBreakdown.map((item, index) => (
                                        <div key={item.type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <span className="font-medium">{item.type}</span>
                                            <div className="text-right">
                                                <div className="font-bold">{item.weight.toFixed(1)} kg</div>
                                                <div className="text-sm text-gray-500">{item.percentage.toFixed(1)}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Achievements */}
                    {recentAchievements.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recentAchievements.map((achievement, index) => (
                                    <div key={index} className="flex items-center p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                                        <div className="text-2xl mr-3">{achievement.icon}</div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{achievement.name}</div>
                                            <div className="text-sm text-gray-600">{achievement.description}</div>
                                            <div className={`text-xs font-medium mt-1 ${
                                                achievement.rarity === 'legendary' ? 'text-purple-600' :
                                                achievement.rarity === 'epic' ? 'text-orange-600' :
                                                achievement.rarity === 'rare' ? 'text-blue-600' : 'text-green-600'
                                            }`}>
                                                {achievement.rarity.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Trends Tab */}
            {activeTab === 'trends' && (
                <div className="space-y-6">
                    {/* Enhanced Trend Analysis */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Monthly Impact Trends</h3>
                            <div className="flex space-x-2">
                                <button className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Weight</button>
                                <button className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full">CO2</button>
                                <button className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">Points</button>
                            </div>
                        </div>
                        {dashboard.monthlyTrends.length > 0 ? (
                            <div className="h-96">
                                <Line data={monthlyTrendsData} options={chartOptions} />
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-4">📊</div>
                                <p className="text-gray-500">No trend data available yet. Start logging waste to see your progress!</p>
                                <p className="text-sm text-gray-400 mt-2">Your first month of data will appear here after logging waste.</p>
                            </div>
                        )}
                    </div>

                    {/* Trend Analysis Insights */}
                    {dashboard.monthlyTrends.length >= 2 && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(() => {
                                    const currentMonth = dashboard.monthlyTrends[0];
                                    const previousMonth = dashboard.monthlyTrends[1];
                                    const weightChange = currentMonth.weight - previousMonth.weight;
                                    const pointsChange = currentMonth.points - previousMonth.points;
                                    const co2Change = currentMonth.co2Saved - previousMonth.co2Saved;
                                    
                                    return (
                                        <>
                                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                                <div className={`text-2xl font-bold ${weightChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {weightChange >= 0 ? '↗️' : '↘️'} {Math.abs(weightChange).toFixed(1)}kg
                                                </div>
                                                <div className="text-sm text-gray-600">Weight Change</div>
                                                <div className="text-xs text-gray-500">vs. last month</div>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                                <div className={`text-2xl font-bold ${pointsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {pointsChange >= 0 ? '↗️' : '↘️'} {Math.abs(pointsChange).toLocaleString()}
                                                </div>
                                                <div className="text-sm text-gray-600">Points Change</div>
                                                <div className="text-xs text-gray-500">vs. last month</div>
                                            </div>
                                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                                <div className={`text-2xl font-bold ${co2Change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {co2Change >= 0 ? '↗️' : '↘️'} {Math.abs(co2Change).toFixed(1)}kg
                                                </div>
                                                <div className="text-sm text-gray-600">CO2 Change</div>
                                                <div className="text-xs text-gray-500">vs. last month</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Performance Insights */}
                    {dashboard.monthlyTrends.length >= 3 && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
                            <div className="space-y-4">
                                {(() => {
                                    const trends = dashboard.monthlyTrends.slice(0, 3);
                                    const avgWeight = trends.reduce((sum, t) => sum + t.weight, 0) / trends.length;
                                    const bestMonth = trends.reduce((best, current) => 
                                        current.weight > best.weight ? current : best
                                    );
                                    const totalGrowth = trends[0].weight - trends[trends.length - 1].weight;
                                    
                                    return (
                                        <>
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                                                <div className="flex items-center">
                                                    <div className="text-2xl mr-3">📈</div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">3-Month Average</div>
                                                        <div className="text-sm text-gray-600">{avgWeight.toFixed(1)}kg per month</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                                                <div className="flex items-center">
                                                    <div className="text-2xl mr-3">🏆</div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">Best Month</div>
                                                        <div className="text-sm text-gray-600">
                                                            {new Date(bestMonth.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {bestMonth.weight.toFixed(1)}kg
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                                                <div className="flex items-center">
                                                    <div className="text-2xl mr-3">{totalGrowth >= 0 ? '🚀' : '📉'}</div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">3-Month Trend</div>
                                                        <div className="text-sm text-gray-600">
                                                            {totalGrowth >= 0 ? 'Growing' : 'Declining'} by {Math.abs(totalGrowth).toFixed(1)}kg
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Monthly Breakdown Table */}
                    {dashboard.monthlyTrends.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (kg)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CO2 Saved (kg)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pickups</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {dashboard.monthlyTrends.slice().reverse().map((trend, index, array) => {
                                            const prevTrend = array[index + 1];
                                            const weightTrend = prevTrend ? trend.weight - prevTrend.weight : 0;
                                            
                                            return (
                                                <tr key={trend.month} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {new Date(trend.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trend.weight.toFixed(1)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trend.points.toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trend.co2Saved.toFixed(2)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trend.pickupsCompleted}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        {prevTrend ? (
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                weightTrend > 0 ? 'bg-green-100 text-green-800' :
                                                                weightTrend < 0 ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {weightTrend > 0 ? '↗️ +' : weightTrend < 0 ? '↘️ ' : '→ '}{Math.abs(weightTrend).toFixed(1)}kg
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
                <div className="space-y-6">
                    {/* Achievement Summary */}
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Achievement Progress</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    You've unlocked {dashboard.achievements.length} achievements! Keep recycling to earn more.
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-yellow-600">{dashboard.achievements.length}</div>
                                <div className="text-sm text-gray-500">Total Achievements</div>
                            </div>
                        </div>
                        
                        {/* Achievement Rarity Breakdown */}
                        <div className="mt-4 grid grid-cols-4 gap-4">
                            {['common', 'rare', 'epic', 'legendary'].map(rarity => {
                                const count = dashboard.achievements.filter(a => a.rarity === rarity).length;
                                const colors = {
                                    common: 'bg-gray-100 text-gray-700 border-gray-300',
                                    rare: 'bg-blue-100 text-blue-700 border-blue-300',
                                    epic: 'bg-purple-100 text-purple-700 border-purple-300',
                                    legendary: 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                };
                                
                                return (
                                    <div key={rarity} className={`text-center p-3 rounded-lg border ${colors[rarity]}`}>
                                        <div className="text-xl font-bold">{count}</div>
                                        <div className="text-xs capitalize">{rarity}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Milestone Progress */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestone Progress</h3>
                        <div className="space-y-6">
                            {/* Weight Milestones */}
                            <div>
                                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                                    <span className="text-xl mr-2">♻️</span>
                                    Recycling Milestones
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { target: 10, name: 'Getting Started', achieved: dashboard.milestones?.first10kg?.achieved, bonus: 50 },
                                        { target: 50, name: 'Eco Enthusiast', achieved: dashboard.milestones?.first50kg?.achieved, bonus: 100 },
                                        { target: 100, name: 'Recycling Champion', achieved: dashboard.milestones?.first100kg?.achieved, bonus: 200 },
                                        { target: 500, name: 'Eco Warrior', achieved: dashboard.milestones?.ecoWarrior?.achieved, bonus: 500 }
                                    ].map((milestone, index) => {
                                        const progress = Math.min((dashboard.totalWasteRecycled / milestone.target) * 100, 100);
                                        const isNextMilestone = !milestone.achieved && (index === 0 || 
                                            (index > 0 && [10, 50, 100][index - 1] <= dashboard.totalWasteRecycled));
                                        
                                        return (
                                            <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                                                isNextMilestone ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                                            }`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    milestone.achieved ? 'bg-green-500 text-white' : 
                                                    isNextMilestone ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {milestone.achieved ? '✓' : index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">{milestone.name}</span>
                                                            {milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                    Completed!
                                                                </span>
                                                            )}
                                                            {isNextMilestone && !milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                                                    Next Goal
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-gray-500">
                                                                {dashboard.totalWasteRecycled.toFixed(1)} / {milestone.target} kg
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">
                                                                +{milestone.bonus} bonus points
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <div 
                                                            className={`h-3 rounded-full transition-all duration-500 ${
                                                                milestone.achieved ? 'bg-green-500' : 
                                                                isNextMilestone ? 'bg-blue-500' : 'bg-gray-400'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    {isNextMilestone && !milestone.achieved && (
                                                        <div className="text-xs text-blue-600 mt-1">
                                                            {(milestone.target - dashboard.totalWasteRecycled).toFixed(1)}kg to go!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Pickup Milestones */}
                            <div>
                                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                                    <span className="text-xl mr-2">🚚</span>
                                    Pickup Milestones
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { target: 10, name: 'Pickup Pro', achieved: dashboard.milestones?.first10Pickups?.achieved, bonus: 100 },
                                        { target: 50, name: 'Collection Master', achieved: dashboard.milestones?.first50Pickups?.achieved, bonus: 250 }
                                    ].map((milestone, index) => {
                                        const progress = Math.min((dashboard.pickupsCompleted / milestone.target) * 100, 100);
                                        const isNextMilestone = !milestone.achieved && (index === 0 || 
                                            (index > 0 && 10 <= dashboard.pickupsCompleted));
                                        
                                        return (
                                            <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                                                isNextMilestone ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
                                            }`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    milestone.achieved ? 'bg-green-500 text-white' : 
                                                    isNextMilestone ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {milestone.achieved ? '✓' : index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">{milestone.name}</span>
                                                            {milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                    Completed!
                                                                </span>
                                                            )}
                                                            {isNextMilestone && !milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                                                    Next Goal
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-gray-500">
                                                                {dashboard.pickupsCompleted} / {milestone.target} pickups
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">
                                                                +{milestone.bonus} bonus points
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <div 
                                                            className={`h-3 rounded-full transition-all duration-500 ${
                                                                milestone.achieved ? 'bg-green-500' : 
                                                                isNextMilestone ? 'bg-purple-500' : 'bg-gray-400'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    {isNextMilestone && !milestone.achieved && (
                                                        <div className="text-xs text-purple-600 mt-1">
                                                            {milestone.target - dashboard.pickupsCompleted} pickups to go!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Streak Milestones */}
                            <div>
                                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                                    <span className="text-xl mr-2">🔥</span>
                                    Streak Milestones
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { target: 7, name: 'Week Warrior', achieved: dashboard.milestones?.weekStreak?.achieved, bonus: 75 },
                                        { target: 30, name: 'Consistency King', achieved: dashboard.milestones?.monthStreak?.achieved, bonus: 300 }
                                    ].map((milestone, index) => {
                                        const progress = Math.min((dashboard.longestStreak / milestone.target) * 100, 100);
                                        const isNextMilestone = !milestone.achieved && (index === 0 || 
                                            (index > 0 && 7 <= dashboard.longestStreak));
                                        
                                        return (
                                            <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                                                isNextMilestone ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                                            }`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    milestone.achieved ? 'bg-green-500 text-white' : 
                                                    isNextMilestone ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {milestone.achieved ? '✓' : index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">{milestone.name}</span>
                                                            {milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                    Completed!
                                                                </span>
                                                            )}
                                                            {isNextMilestone && !milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                                                    Next Goal
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-gray-500">
                                                                {dashboard.longestStreak} / {milestone.target} days
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">
                                                                +{milestone.bonus} bonus points
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <div 
                                                            className={`h-3 rounded-full transition-all duration-500 ${
                                                                milestone.achieved ? 'bg-green-500' : 
                                                                isNextMilestone ? 'bg-orange-500' : 'bg-gray-400'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    {isNextMilestone && !milestone.achieved && (
                                                        <div className="text-xs text-orange-600 mt-1">
                                                            {milestone.target - dashboard.longestStreak} days to go!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* CO2 Milestones */}
                            <div>
                                <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                                    <span className="text-xl mr-2">🌍</span>
                                    Environmental Impact Milestones
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { target: 100, name: 'Carbon Saver', achieved: dashboard.milestones?.carbonSaver?.achieved, metric: 'kg CO₂', bonus: 200 }
                                    ].map((milestone, index) => {
                                        const progress = Math.min((dashboard.co2Saved / milestone.target) * 100, 100);
                                        const isNextMilestone = !milestone.achieved;
                                        
                                        return (
                                            <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                                                isNextMilestone ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'
                                            }`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    milestone.achieved ? 'bg-green-500 text-white' : 
                                                    isNextMilestone ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {milestone.achieved ? '✓' : '1'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">{milestone.name}</span>
                                                            {milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                                    Completed!
                                                                </span>
                                                            )}
                                                            {isNextMilestone && !milestone.achieved && (
                                                                <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                                                                    Next Goal
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-gray-500">
                                                                {dashboard.co2Saved.toFixed(1)} / {milestone.target} {milestone.metric}
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">
                                                                +{milestone.bonus} bonus points
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <div 
                                                            className={`h-3 rounded-full transition-all duration-500 ${
                                                                milestone.achieved ? 'bg-green-500' : 
                                                                isNextMilestone ? 'bg-teal-500' : 'bg-gray-400'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    {isNextMilestone && !milestone.achieved && (
                                                        <div className="text-xs text-teal-600 mt-1">
                                                            {(milestone.target - dashboard.co2Saved).toFixed(1)}kg CO₂ to go!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* All Achievements */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Achievements ({dashboard.achievements.length})</h3>
                        {dashboard.achievements.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {dashboard.achievements
                                    .sort((a, b) => {
                                        const rarityOrder = { 'legendary': 4, 'epic': 3, 'rare': 2, 'common': 1 };
                                        if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
                                            return rarityOrder[b.rarity] - rarityOrder[a.rarity];
                                        }
                                        return new Date(b.unlockedAt) - new Date(a.unlockedAt);
                                    })
                                    .map((achievement, index) => (
                                    <div key={index} className={`p-4 rounded-lg border-2 transform transition-all hover:scale-105 ${
                                        achievement.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 border-yellow-300 shadow-lg' :
                                        achievement.rarity === 'epic' ? 'bg-gradient-to-br from-purple-100 to-purple-200 border-purple-300 shadow-md' :
                                        achievement.rarity === 'rare' ? 'bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300 shadow-md' :
                                        'bg-gradient-to-br from-green-100 to-green-200 border-green-300'
                                    }`}>
                                        <div className="text-center">
                                            <div className="text-4xl mb-2">{achievement.icon}</div>
                                            <div className="font-bold text-gray-900">{achievement.name}</div>
                                            <div className="text-sm text-gray-600 mt-1">{achievement.description}</div>
                                            <div className={`text-xs font-bold mt-2 px-2 py-1 rounded-full inline-block ${
                                                achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-800' :
                                                achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-800' :
                                                achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                                            }`}>
                                                {achievement.rarity.toUpperCase()}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-2">
                                                Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🏆</div>
                                <p className="text-gray-500 text-lg">No achievements yet</p>
                                <p className="text-sm text-gray-400 mt-2">Start recycling to unlock your first achievement!</p>
                                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-700">
                                        💡 <strong>Tip:</strong> Log your first waste item to earn the "First Steps" achievement!
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImpactDashboard;
                           