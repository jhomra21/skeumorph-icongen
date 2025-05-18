import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'

// Define a type for the binding that Hono will expect for environment variables
type Bindings = {
  FAL_KEY: string;
  // Add other environment bindings if you have them
}

// Types for Fal AI API
interface FalLoraWeight {
  path: string;
  scale: number;
}

interface FalImageSizeObject {
  width: number;
  height: number;
}

type FalImageSize = "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9" | FalImageSizeObject;
type FalOutputFormat = "jpeg" | "png";

interface FalGenerateRequestBody {
  prompt: string;
  image_size?: FalImageSize;
  num_inference_steps?: number;
  seed?: number;
  loras?: FalLoraWeight[];
  guidance_scale?: number;
  sync_mode?: boolean;
  num_images?: number;
  enable_safety_checker?: boolean;
  output_format?: FalOutputFormat;
}

// interface FalImageOutput {
//   url: string;
//   content_type: string;
//   width: number;
//   height: number;
// }

// // Timings type might need more specific fields if known, using 'any' for now
// interface FalTimings {
//   [key: string]: any; 
// }

// interface FalGenerateSuccessResponse {
//   images: FalImageOutput[];
//   timings: FalTimings; // Assuming Timings is an object, adjust if more structure is known
//   seed: number;
//   has_nsfw_concepts: boolean[];
//   prompt: string;
// }

interface FalErrorResponse {
  detail?: string | { msg: string; type: string; loc: (string | number)[] }[];
  status_code?: number; // From Fal AI error structure if it has one
  error?: string; // General error message
  message?: string; // Alternative error message field
}

const app = new Hono<{ Bindings: Bindings }>()

// Apply CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))

app.get('/', (c: Context<{ Bindings: Bindings }>) => c.text('Hello Hono on Cloudflare Workers for Fal AI Proxy!'))



// New route for Fal AI image generation with streaming
app.post('/api/generate-icon-stream', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const body = await c.req.json<{ prompt: string; image_size?: FalImageSize; output_format?: FalOutputFormat }>();
    const { prompt, image_size, output_format } = body;

    if (!prompt) {
      return c.json({ error: 'Missing prompt' }, 400);
    }
    
    if (!c.env.FAL_KEY) {
      console.error('FAL_KEY not configured in Cloudflare Worker environment.');
      return c.json({ error: 'API key not configured on server.' }, 500);
    }

    // Append required string to the prompt and add LoRA configuration
    const modifiedPrompt = `RBNBICN, icon, white background, isometric perspective, ${prompt.trim()}`;

    const falRequestBody: FalGenerateRequestBody = {
      prompt: modifiedPrompt,
      image_size: image_size || "square", // Default to square if not specified, Fal uses landscape_4_3 by default
      num_images: 1, // Must be 1 for streaming
      output_format: output_format || "jpeg",
      num_inference_steps: 28, // As per user example
      guidance_scale: 2.5,    // As per user example
      enable_safety_checker: false, // As per user example, though it's Fal's default
      loras: [
        {
          path: "https://huggingface.co/multimodalart/isometric-skeumorphic-3d-bnb/blob/main/isometric-skeumorphic-3d-bnb.safetensors",
          scale: 1.0 // Default scale is 1, explicitly setting for clarity
        }
      ]
      // sync_mode is not used for streaming endpoint
    };

    const falApiStreamUrl = 'https://fal.run/fal-ai/flux-lora/stream';
    
    const falResponse = await fetch(falApiStreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json',
        'Accept': `image/${falRequestBody.output_format}`, // Tell Fal we expect an image stream
      },
      body: JSON.stringify(falRequestBody),
    });

    if (!falResponse.ok) {
      let errorBody: FalErrorResponse | string = 'Failed to generate image stream from Fal AI.';
      try {
        errorBody = await falResponse.json(); // Fal might still send JSON error for stream endpoint
      } catch (e) {
        errorBody = await falResponse.text(); // Or it might be plain text
      }
      console.error('Fal AI API stream error:', errorBody, 'Status:', falResponse.status);
      c.status(falResponse.status as any);
      return c.json({ 
        error: 'Fal AI API stream request failed.', 
        details: errorBody 
      });
    }

    // If successful, Fal AI streams the image data directly.
    // We need to pass this stream to the client.
    // Set the Content-Type header from Fal AI's response if available, 
    // otherwise use the one from our request or what Fal sends.
    const contentType = falResponse.headers.get('Content-Type') || `image/${falRequestBody.output_format || 'png'}`;
    
    c.header('Content-Type', contentType);
    if (falResponse.body) {
      return c.body(falResponse.body);
    } else {
      console.error('Fal AI stream response body was null despite a successful status.');
      return c.json({ error: 'Fal AI stream response body was unexpectedly null.' }, 500);
    }

  } catch (error: any) {
    console.error('Error processing image generation stream request:', error.message, error.stack);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return c.json({ error: 'Invalid JSON in request body for stream.' }, 400);
    }
    return c.json({ error: error.message || 'Failed to process image generation stream request' }, 500);
  }
})

export default app