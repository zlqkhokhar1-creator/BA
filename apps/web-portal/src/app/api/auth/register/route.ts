import { NextRequest, NextResponse } from 'next/server';

// Mock user data (in real app, this would be in a database)
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
  }
];

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, accountType } = await request.json();

    if (!email || !password || !firstName || !lastName || !accountType) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      email,
      password,
      firstName,
      lastName,
      accountType,
      balance: 10000, // Starting balance
      createdAt: new Date().toISOString(),
    };

    // In a real app, save to database
    mockUsers.push(newUser);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    // Generate a mock JWT token
    const token = Buffer.from(JSON.stringify({ 
      userId: newUser.id, 
      email: newUser.email,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    return NextResponse.json({
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

