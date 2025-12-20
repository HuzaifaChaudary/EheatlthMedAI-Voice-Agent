import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming utils exists

interface DashboardStatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    trend?: {
        value: number;
        label: string;
        positive?: boolean;
    };
    className?: string;
}

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    className,
}) => {
    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {(description || trend) && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {trend && (
                            <span className={cn(
                                "mr-1 font-medium",
                                trend.positive ? "text-green-600" : "text-red-600"
                            )}>
                                {trend.positive ? "+" : ""}{trend.value}%
                            </span>
                        )}
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
