import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Activity, HardDrive, Download, Thermometer, Cpu, User } from 'lucide-react'
import { useState, useEffect } from "react"

interface HardwareData {
  CPU: string
  TempCPU: string
  RAM: string
  diskTotal: number
  diskUsed: number
}

const COLORS = ['#0088FE', '#ECEFF1']

interface DashboardProps {
  user: {
    username: string
    role: string
  }
}

export default function Dashboard({ user }: DashboardProps) {
  const [hardware, setHardware] = useState<HardwareData | null>(null)

  useEffect(() => {
    fetchHardware(); // Llamado inicial

    const interval = setInterval(fetchHardware, 3000); // Llama a fetchHardware cada 5 segundos

    return () => clearInterval(interval); // Limpieza del intervalo al desmontar
  }, []);

  const fetchHardware = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/hardware");
      if (!response.ok) throw new Error("Failed to fetch hardware info");

      const data = await response.json();

      // Extraer valores de "disk" usando una expresión regular
      const diskMatch = data.disk.match(/total=(\d+), used=(\d+), free=(\d+)/);

      const diskTotalGB = diskMatch ? (parseInt(diskMatch[1]) / (1024 ** 3)).toFixed(2) : "0";
      const diskUsedGB = diskMatch ? (parseInt(diskMatch[2]) / (1024 ** 3)).toFixed(2) : "0";

      // Extraer valores numéricos de CPU y RAM
      const cpuUsage = parseFloat(data.used_CPU.replace(" %", ""));
      const ramUsage = parseFloat(data.used_RAM.match(/\((\d+.\d+)%\)/)?.[1] || "0");
      const tempCPU = data.Temp_CPU;

      setHardware({
        CPU: cpuUsage.toString(),
        TempCPU: tempCPU.toString(),
        RAM: ramUsage.toString(),
        diskTotal: parseFloat(diskTotalGB),
        diskUsed: parseFloat(diskUsedGB),
      });

      console.log({
        CPU: cpuUsage,
        TempCPU: tempCPU,
        RAM: ramUsage,
        diskTotal: diskTotalGB,
        diskUsed: diskUsedGB,
      });

    } catch (error) {
      console.error("Error fetching hardware info:", error);
    }
  };


  const storageData = hardware
    ? [
      { name: 'Used', value: hardware.diskUsed },
      { name: 'Free', value: hardware.diskTotal - hardware.diskUsed }
    ]
    : [
      { name: 'Used', value: 0 },
      { name: 'Free', value: 100 }
    ]

  const cpuUsage = parseFloat(hardware?.CPU || "0")
  const ramUsage = parseFloat(hardware?.RAM || "0")
  const tempCPU = parseFloat(hardware?.TempCPU || "0")

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
        {/* Storage Usage */}
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
              {/* Total Space */}
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Space</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {hardware ? `${hardware.diskTotal.toFixed(2)} GB` : "Loading..."}
                </span>
              </div>

              {/* Free Space */}
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Free Space</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {hardware ? `${(hardware.diskTotal - hardware.diskUsed).toFixed(2)} GB` : "Loading..."}
                </span>
              </div>

              {/* Progress Bar */}
              <Progress
                value={hardware ? (hardware.diskUsed / hardware.diskTotal) * 100 : 0}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              />
            </div>

          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <Cpu className="w-5 h-5 mr-2 text-yellow-500 dark:text-yellow-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">CPU Usage: {cpuUsage}%</span>
              </div>
              <Progress value={cpuUsage} className="h-2 bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center">
                <Thermometer
                  className={`w-5 h-5 mr-2 ${tempCPU > 75 ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"
                    }`}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">CPU Temp: {tempCPU}°C</span>
              </div>
              <div className="flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-green-500 dark:text-green-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">RAM Usage: {ramUsage}%</span>
              </div>
              <Progress value={ramUsage} className="h-2 bg-gray-200 dark:bg-gray-700" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
