import { NextRequest, NextResponse } from 'next/server';

// Mock user data
const mockUsers = [
  {
    id: '1',
    email: 'demo@trading.com',
    password: 'demo123',
    firstName: 'John',
    lastName: 'Doe',
    accountType: 'INDIVIDUAL' as const,
    balance: 100000,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'admin@trading.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    accountType: 'PROFESSIONAL' as const,
    balance: 500000,
    createdAt: new Date().toISOString(),
  }
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = mockUsers.find(u => u.email === email);
    
    if (!user || user.password !== password) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate a mock JWT token (in real app, use proper JWT library)
    const token = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      email: user.email,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    return NextResponse.json({
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

