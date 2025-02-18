import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Activity, HardDrive, Download, User } from 'lucide-react'

const storageData = [
  { name: 'Used', value: 400 },
  { name: 'Free', value: 600 },
]

const COLORS = ['#0088FE', '#ECEFF1']

interface DashboardProps {
  user: {
    username: string;
    role: string;
  }
}

export default function Dashboard({ user }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Dashboard</h1>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <User className="h-4 w-4" />
          <span>{user.username} ({user.role})</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageData}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {storageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Space</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">1 TB</span>
              </div>
              <Progress value={40} className="h-2 bg-gray-200 dark:bg-gray-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-green-500 dark:text-green-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">System Status: Normal</span>
              </div>
              <div className="flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Drives: 2/4 Healthy</span>
              </div>
              <div className="flex items-center">
                <Download className="w-5 h-5 mr-2 text-purple-500 dark:text-purple-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Network: 1 Gbps</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

