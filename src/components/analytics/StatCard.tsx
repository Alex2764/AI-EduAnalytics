import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'gray';
  icon?: string;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, color, icon, subtitle }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const valueColorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]} text-center shadow-sm`}>
      {icon && (
        <div className="text-2xl mb-2">{icon}</div>
      )}
      <div className={`text-2xl font-bold ${valueColorClasses[color]} mb-1`}>
        {value}
      </div>
      <div className="text-sm font-medium">
        {title}
      </div>
      {subtitle && (
        <div className="text-xs opacity-75 mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
