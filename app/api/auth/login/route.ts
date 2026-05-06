import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
    // Explicitly check if URI is set
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ success: false, message: 'Database configuration missing' }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db('konfeksi_db');
    
    // Check in 'admins' collection
    const user = await db.collection('admins').findOne({ username });
    
    if (user) {
      let isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      
      // Fallback for plain text passwords in transition period
      if (!isMatch && password === user.password) {
        isMatch = true;
      }

      if (isMatch) {
         return NextResponse.json({ success: true, role: user.role || 'admin', username: user.username });
      }
    }
    
    return NextResponse.json({ success: false, message: 'Username atau password salah' }, { status: 401 });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Gagal terhubung ke database. Pastikan MONGODB_URI sudah benar.' 
    }, { status: 500 });
  }
}
