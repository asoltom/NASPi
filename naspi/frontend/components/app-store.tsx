import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Search } from 'lucide-react'

const mockApps = [
  { name: 'Media Server', description: 'Stream your media files' },
  { name: 'Backup Manager', description: 'Automated backup solution' },
  { name: 'Download Station', description: 'Manage your downloads' },
  { name: 'VPN Server', description: 'Secure remote access' },
]

export default function AppStore() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">App Store</h1>
        <div className="flex w-full md:w-auto">
          <Input placeholder="Search apps..." className="w-full md:w-64 rounded-r-none" />
          <Button className="rounded-l-none" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {mockApps.map((app, index) => (
          <Card key={index} className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">{app.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{app.description}</p>
              <div className="flex justify-between items-center">
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Install
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

