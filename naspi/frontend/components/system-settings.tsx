"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network, HardDrive, Users, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface User {
  id: string
  username: string
  role: string
}

interface TelematicData {
  ip: string
  gateway: string
  mask: string
  dns: string
}

interface NASData {
  status: string
  speed: string
}

export default function SystemSettings() {
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" })
  const [userMessage, setUserMessage] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [telematic, setTelematic] = useState<TelematicData | null>(null)
  const [NASstatus, setNASStatus] = useState<NASData | null>(null)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchTelematic()
    fetchNASStatus()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://naspi.local:5000/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("http://naspi.local:5000/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })
      const data = await response.json()
      setUserMessage(data.message)
      if (response.ok) {
        setNewUser({ username: "", password: "", role: "user" })
        fetchUsers() // Refresh the user list
      }
    } catch (error) {
      setUserMessage("An error occurred. Please try again.")
    }
  }

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return

    try {
      const response = await fetch(`http://naspi.local:5000/api/users?id=${userToDelete.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      setUserMessage(data.message)
      if (response.ok) {
        fetchUsers() // Refresh the user list
      }
    } catch (error) {
      setUserMessage("An error occurred while deleting the user.")
    }

    setIsDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  const fetchTelematic = async () => {
    try {
      const response = await fetch("http://naspi.local:5000/api/telematic")
      if (!response.ok) throw new Error("Failed to fetch telematic info")
      const data: TelematicData = await response.json()
      setTelematic(data)
    } catch (error) {
      console.error("Error fetching telematic info:", error)
    }
  }

  const fetchNASStatus = async () => {
    try {
      const response = await fetch("http://naspi.local:5000/api/nas_status")
      if (!response.ok) throw new Error("Failed to fetch telematic info")
      console.log("Response:")
      console.log(response)
      
      const data: NASData = await response.json()
      console.log("Data_NAS:")
      console.log(data)

      setNASStatus(data)
    } catch (error) {
      console.error("Error fetching telematic info:", error)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">System Settings</h1>
      <Tabs defaultValue="network" className="space-y-4">
        <TabsList className="grid grid-cols-3 gap-4">
          <TabsTrigger value="network" className="w-full">
            <Network className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Network</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="w-full">
            <HardDrive className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Storage</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="w-full">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network">
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Network Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ip-address">IP Address</Label>
                  <Input id="ip-address" value={telematic?.ip || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subnet-mask">Subnet Mask</Label>
                  <Input id="subnet-mask" value={telematic?.mask || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gateway">Gateway</Label>
                  <Input id="gateway" value={telematic?.gateway || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dns">DNS Server</Label>
                  <Input id="dns" value={telematic?.dns || ""} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage">
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Storage Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="raid-type">RAID Type</Label>
                  <Input id="raid-type" value="RAID 5" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip-address">SSD status</Label>
                  <Input id="ip-address" value={NASstatus?.status || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip-address">SSD speed</Label>
                  <Input id="ip-address" value={NASstatus?.speed || ""} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">User Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full sm:w-auto">
                  Add User
                </Button>
              </form>
              {userMessage && <p className="mt-4 text-center">{userMessage}</p>}

              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">User List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3">Username</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                          <td className="px-6 py-4">{user.username}</td>
                          <td className="px-6 py-4">{user.role}</td>
                          <td className="px-6 py-4">
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              {userToDelete && <strong> {userToDelete.username}</strong>}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}