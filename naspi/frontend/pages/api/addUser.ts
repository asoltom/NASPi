import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { username, password, role } = req.body

    // Read the current users
    const usersFilePath = path.join(process.cwd(), 'data', 'users.json')
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

    // Check if user already exists
    if (usersData.some((user: any) => user.username === username)) {
      return res.status(400).json({ message: 'Username already exists' })
    }

    // Create new user
    const newUser = {
      id: String(usersData.length + 1),
      username,
      password, // In a real app, you should hash the password
      role: role || 'user'
    }

    // Add new user to the array
    usersData.push(newUser)

    // Write updated users back to file
    fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2))

    res.status(201).json({ message: 'User added successfully' })
  } else if (req.method === 'GET') {
    // Read the current users
    const usersFilePath = path.join(process.cwd(), 'data', 'users.json')
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

    // Return the list of users (excluding passwords)
    const safeUsersData = usersData.map(({ id, username, role }: any) => ({ id, username, role }))
    res.status(200).json(safeUsersData)
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}

