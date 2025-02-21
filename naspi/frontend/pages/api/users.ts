import type { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

interface User {
  id: string
  username: string
  password: string
  role: string
}

const usersFilePath = path.join(process.cwd(), "data", "users.json")

function saveUsers(users: User[]) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2))
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { username, password, role } = req.body

    // Read the current users
    const usersData: User[] = JSON.parse(fs.readFileSync(usersFilePath, "utf8"))

    // Check if user already exists
    if (usersData.some((user) => user.username === username)) {
      return res.status(400).json({ message: "Username already exists" })
    }

    // Create new user with a unique ID
    const newUser: User = {
      id: uuidv4(),
      username,
      password, // In a real app, you should hash the password
      role: role || "user",
    }

    // Add new user to the array
    usersData.push(newUser)

    // Save updated users
    saveUsers(usersData)

    res.status(201).json({ message: "User added successfully" })
  } else if (req.method === "GET") {
    // Read the current users
    const usersData: User[] = JSON.parse(fs.readFileSync(usersFilePath, "utf8"))

    // Return the list of users (excluding passwords)
    const safeUsersData = usersData.map(({ id, username, role }) => ({ id, username, role }))
    res.status(200).json(safeUsersData)
  } else if (req.method === "DELETE") {
    const { id } = req.query

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Valid user ID is required" })
    }

    // Read the current users
    const usersData: User[] = JSON.parse(fs.readFileSync(usersFilePath, "utf8"))

    // Find the user to delete
    const updatedUsers = usersData.filter((user) => user.id !== id)

    if (updatedUsers.length === usersData.length) {
      return res.status(404).json({ message: "User not found" })
    }

    // Save updated users
    saveUsers(updatedUsers)

    res.status(200).json({ message: "User deleted successfully" })
  } else {
    res.status(405).json({ message: "Method not allowed" })
  }
}

