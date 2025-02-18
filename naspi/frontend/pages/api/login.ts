import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { username, password } = req.body

    // Read the current users
    const usersFilePath = path.join(process.cwd(), 'data', 'users.json')
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

    // Find user
    const user = usersData.find((u: any) => u.username === username && u.password === password)

    if (user) {
      // In a real app, you would create a JWT token here
      res.status(200).json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } })
    } else {
      res.status(401).json({ message: 'Invalid credentials' })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}

