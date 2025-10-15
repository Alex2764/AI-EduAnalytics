import React from 'react';

interface StudentStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'gray';
}

const colorClasses = {
  green: 'bg-green-50 border-green-200 text-green-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  purple: 'bg-purple-50 border-purple-200 text-purple-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
};

export const StudentStatsCard: React.FC<StudentStatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'gray',
}) => {
  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
          <p className="text-2xl font-bold mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs opacity-70">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-3xl ml-2 opacity-80">{icon}</div>
        )}
      </div>
    </div>
  );
};


