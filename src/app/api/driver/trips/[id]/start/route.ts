import { NextRequest, NextResponse } from 'next/server';

interface StartTripRequest {
  latitude: number;
  longitude: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = (await request.json()) as StartTripRequest;

    if (!body.latitude || !body.longitude) {
      return NextResponse.json(
        { message: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Forward the request to your backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/driver/trips/${tripId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include auth token if needed
        'Authorization': `Bearer ${request.headers.get('authorization')?.split(' ')[1] || ''}`,
      },
      body: JSON.stringify({
        latitude: body.latitude,
        longitude: body.longitude,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error starting trip:', error);
    return NextResponse.json(
      { message: 'Failed to start trip' },
      { status: 500 }
    );
  }
}
