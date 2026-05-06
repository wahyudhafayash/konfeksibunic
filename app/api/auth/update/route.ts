import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { username, currentPassword, newPassword } = await req.json();
    
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ success: false, message: 'Database configuration missing' }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db('konfeksi_db');
    
    // Validate current user
    const user = await db.collection('admins').findOne({ username });
    
    if (user) {
      let isMatch = await bcrypt.compare(currentPassword, user.password).catch(() => false);
      
      // Fallback for plain text passwords in transition period
      if (!isMatch && currentPassword === user.password) {
        isMatch = true;
      }

      if (isMatch) {
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await db.collection('admins').updateOne(
          { username },
          { $set: { password: hashedPassword } }
        );
        return NextResponse.json({ success: true, message: 'Password updated successfully' });
      }
    }
    
    return NextResponse.json({ success: false, message: 'Password lama salah' }, { status: 401 });
  } catch (error: any) {
    console.error('Update auth error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Gagal memperbarui data login.' 
    }, { status: 500 });
  }
}
