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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    try {
      // Decode the mock JWT token
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check if token is expired
      if (tokenData.exp && Date.now() > tokenData.exp) {
        return NextResponse.json(
          { message: 'Token expired' },
          { status: 401 }
        );
      }

      // Find user by ID from token
      const user = mockUsers.find(u => u.id === tokenData.userId);
      
      if (!user) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      return NextResponse.json(userWithoutPassword);

    } catch (tokenError) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

