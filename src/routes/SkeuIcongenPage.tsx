import { createSignal, Show, onCleanup, For } from 'solid-js';
import { useMutation } from '@tanstack/solid-query';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

// This function will now be the core of the mutationFn
// It processes the Server-Sent Event stream and resolves with the final image Object URL.
async function processIconStream(
  prompt: string, 
  setStreamMessage: (message: string | null) => void,
  setLiveImageUrl: (objectUrl: string | null) => void // Callback to update image during stream
): Promise<string> { // Resolves with the *final* image object URL
  setStreamMessage("Initiating stream...");
  const baseUrl = import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://skeumorph-icongen.jhonra121.workers.dev';
  const response = await fetch(`${baseUrl}/api/generate-icon-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt }),
  });

  if (!response.ok) {
    let errorDetails = response.statusText;
    try {
      const errorData = await response.json();
      errorDetails = errorData.details?.message || errorData.details || errorData.error || errorDetails;
    } catch (e) { /* ignore */ }
    setStreamMessage(null);
    setLiveImageUrl(null);
    throw new Error(`API Error (${response.status}): ${errorDetails}`);
  }

  if (!response.body) {
    setStreamMessage(null);
    setLiveImageUrl(null);
    throw new Error('No response body from server for the image stream.');
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let currentObjectUrl: string | null = null; // To keep track of the latest for the final return

  setStreamMessage("Stream connected, processing data...");

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      setStreamMessage("Stream processing complete.");
      // If no image was ever successfully processed from events, currentObjectUrl might be null
      if (!currentObjectUrl) {
        throw new Error("Stream ended but no valid image data was processed.");
      }
      break;
    }

    if (value) buffer += value;

    let eolIndex;
    while ((eolIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, eolIndex).trim();
      buffer = buffer.slice(eolIndex + 1);

      if (line.startsWith('data: ')) {
        try {
          const eventDataString = line.substring(6);
          const jsonData = JSON.parse(eventDataString);

          if (jsonData.images && Array.isArray(jsonData.images) && jsonData.images.length > 0) {
            const imageInfo = jsonData.images[0];
            if (imageInfo.url && typeof imageInfo.url === 'string' && imageInfo.url.startsWith('data:image/')) {
              const parts = imageInfo.url.split(',');
              if (parts.length > 1) {
                const metaPart = parts[0];
                const base64Data = parts[1];
                let contentType = 'image/jpeg'; // Default
                if (metaPart.startsWith('data:') && metaPart.includes(';base64')) {
                  contentType = metaPart.substring(5, metaPart.indexOf(';base64'));
                }
                
                // Create blob and object URL from this event's image data
                const byteString = atob(base64Data);
                const ia = new Uint8Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const blob = new Blob([ia], { type: contentType });
                
                // Revoke previous live URL before creating a new one
                if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
                currentObjectUrl = URL.createObjectURL(blob);
                
                setLiveImageUrl(currentObjectUrl); // Update UI live
                setStreamMessage("Image update received...");
              }
            }
          } else if (jsonData.logs && Array.isArray(jsonData.logs) && jsonData.logs.length > 0) {
            const lastLog = jsonData.logs[jsonData.logs.length - 1]?.message;
            if (lastLog) setStreamMessage(`Progress: ${lastLog}`);
          }
        } catch (e) {
          console.warn('[processIconStream] Error parsing SSE event or processing image data:', e);
        }
      }
    }
  }

  if (!currentObjectUrl) {
      console.error("[processIconStream] Stream ended but no final image URL was generated.");
      setStreamMessage("No image data processed from stream.");
      throw new Error('Image data not found or processed from stream events.');
  }
  return currentObjectUrl; // Return the last successfully processed image URL
}

// Types for our new features
type QuickPrompt = {
  id: string;
  name: string;
  prompt: string;
  category: string;
};

// type StyleOption = {
//   id: string;
//   name: string;
//   value: string;
// };

type GeneratedIcon = {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
};

export function SkeuIcongenPage() {
  // Main prompt state
  const [prompt, setPrompt] = createSignal('');
  const [generatedImageUrl, setGeneratedImageUrl] = createSignal<string | null>(null);
  const [streamMessage, setStreamMessage] = createSignal<string | null>(null);
  
  // New state for enhanced UI
  const [activeTab, setActiveTab] = createSignal<'generate' | 'history'>('generate');
  const [quickPrompts,] = createSignal<QuickPrompt[]>([
    { id: '1', name: 'Glossy Apple', prompt: 'A glossy red apple with a green leaf and metallic highlights', category: 'Food' },
    { id: '2', name: 'Camera', prompt: 'A detailed DSLR camera with leather texture and metal dials', category: 'Tech' },
    { id: '3', name: 'Compass', prompt: 'An antique brass compass with weathered texture and detailed cardinal directions', category: 'Travel' },
    { id: '4', name: 'Game Controller', prompt: 'A modern game controller with rubberized grips and glowing buttons', category: 'Gaming' },
    { id: '5', name: 'Wallet', prompt: 'A leather wallet with stitching details and metal zipper', category: 'Fashion' },
    { id: '6', name: 'Clock', prompt: 'A wooden clock with metal hands and roman numerals', category: 'Home' },
  ]);
  
  // Style options
  const [selectedMaterial, setSelectedMaterial] = createSignal<string>('glossy');
  const [selectedAngle, setSelectedAngle] = createSignal<string>('front');
  const [selectedSize, setSelectedSize] = createSignal<string>('512');
  
  const materials = [
    { id: 'None', name: 'None', value: '' },
    { id: 'glossy', name: 'Glossy', value: 'glossy' },
    { id: 'metallic', name: 'Metallic', value: 'metallic' },
    { id: 'matte', name: 'Matte', value: 'matte' },
    { id: 'wooden', name: 'Wooden', value: 'wooden texture' },
    { id: 'plastic', name: 'Plastic', value: 'plastic' },
    { id: 'glass', name: 'Glass', value: 'glass transparent' }
  ];
  
  const angles = [
    { id: 'front', name: 'Front View', value: 'front view' },
    { id: 'isometric', name: 'Isometric', value: 'isometric view' },
    { id: 'angled', name: 'Angled', value: 'angled view slight perspective' },
    { id: '3d', name: '3D', value: 'full 3D rendering' }
  ];
  
  const sizes = [
    { id: '256', name: '256 × 256', value: '256' },
    { id: '512', name: '512 × 512', value: '512' },
    { id: '1024', name: '1024 × 1024', value: '1024' }
  ];
  
  // History state
  const [iconHistory, setIconHistory] = createSignal<GeneratedIcon[]>([]);
  const [favorites, setFavorites] = createSignal<GeneratedIcon[]>([]);

  // Enhance the prompt with selected style options
  const getEnhancedPrompt = () => {
    const basePrompt = prompt().trim();
    if (!basePrompt) return '';
    
    const material = materials.find(m => m.id === selectedMaterial())?.value || '';
    const angle = angles.find(a => a.id === selectedAngle())?.value || '';
    
    let enhancedPrompt = basePrompt;
    
    // Only append style options if they're not already in the prompt
    if (material && !enhancedPrompt.toLowerCase().includes(material.toLowerCase())) {
      enhancedPrompt += `, ${material}`;
    }
    
    if (angle && !enhancedPrompt.toLowerCase().includes(angle.toLowerCase())) {
      enhancedPrompt += `, ${angle}`;
    }
    
    enhancedPrompt += ', high quality render';
    
    return enhancedPrompt;
  };
  
  // Function to handle quick prompt selection
  const handleQuickPromptSelect = (selectedPrompt: QuickPrompt) => {
    setPrompt(selectedPrompt.prompt);
  };

  // Function to handle live image updates from the stream processor
  const handleLiveImageUpdate = (objectUrl: string | null) => {
    const oldUrl = generatedImageUrl();
    if (oldUrl && oldUrl !== objectUrl) {
      // This check is a bit tricky because processIconStream internally manages currentObjectUrl
      // and its revocation. Setting it here might lead to double revocation or revoking too early.
      // For now, let processIconStream manage its internal URLs, and onSuccess will set the final one.
      // For live updates, generatedImageUrl is directly set.
    }
    setGeneratedImageUrl(objectUrl); // Update displayed image
  };

  const generationMutation = useMutation<string, Error, string, unknown>(() => ({
    mutationFn: (currentPrompt: string) => processIconStream(currentPrompt, setStreamMessage, handleLiveImageUpdate),
    onSuccess: (finalObjectUrl: string) => {
      // The finalObjectUrl from processIconStream is the last one generated.
      // handleLiveImageUpdate has already been setting generatedImageUrl.
      // Ensure generatedImageUrl reflects this final one.
      if (generatedImageUrl() !== finalObjectUrl) {
          // If there was an existing URL different from the final one, revoke it.
          // (This might be redundant if handleLiveImageUpdate is always in sync, but safe)
          if (generatedImageUrl()) URL.revokeObjectURL(generatedImageUrl()!);
          setGeneratedImageUrl(finalObjectUrl);
      }
      
      // Add to history
      if (finalObjectUrl) {
        const newIcon: GeneratedIcon = {
          id: Date.now().toString(),
          imageUrl: finalObjectUrl,
          prompt: prompt(),
          timestamp: Date.now()
        };
        
        setIconHistory(prev => [newIcon, ...prev]);
      }
      
      setStreamMessage(null); 
    },
    onError: (error: Error) => {
      console.error("Mutation onError:", error);
      // generatedImageUrl might have been set to an intermediate image. Clear it on final error.
      if (generatedImageUrl()) {
        URL.revokeObjectURL(generatedImageUrl()!); 
        setGeneratedImageUrl(null);
      }
      // setStreamMessage is usually handled by processIconStream, but set a generic one here if not already set.
      if (!streamMessage()) setStreamMessage(`Error: ${error.message}`);
    },
    onMutate: () => {
        if (generatedImageUrl()) {
            URL.revokeObjectURL(generatedImageUrl()!);
            setGeneratedImageUrl(null);
        }
        setStreamMessage("Preparing to generate...");
    }
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const enhancedPrompt = getEnhancedPrompt();
    if (!enhancedPrompt) {
      alert("Please enter a prompt.");
      return;
    }
    generationMutation.mutate(enhancedPrompt);
  };
  
  const toggleFavorite = (icon: GeneratedIcon) => {
    const isFavorite = favorites().some(fav => fav.id === icon.id);
    
    if (isFavorite) {
      setFavorites(prev => prev.filter(fav => fav.id !== icon.id));
    } else {
      setFavorites(prev => [icon, ...prev]);
    }
  };
  
  const downloadIcon = (icon: GeneratedIcon) => {
    const link = document.createElement('a');
    link.href = icon.imageUrl;
    link.download = `icon-${icon.prompt.substring(0, 20).replace(/\s+/g, '-') || 'generated'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  onCleanup(() => {
    if (generatedImageUrl()) {
      URL.revokeObjectURL(generatedImageUrl()!);
    }
    
    // Clean up any history object URLs
    iconHistory().forEach(icon => {
      URL.revokeObjectURL(icon.imageUrl);
    });
    
    // Note: processIconStream's internal currentObjectUrl is not cleaned up here
    // as it's local to that function's execution. It should be revoked before a new one is made.
  });

  return (
    <div class="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 min-h-full flex flex-col">
      <div class="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 flex-grow flex flex-col">
        <h1 class="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">Skeuomorphic Icon Generator</h1>
        
        {/* Tabs */}
        <div class="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('generate')}
            class={`px-4 py-2 text-sm font-medium ${activeTab() === 'generate' 
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Generate
          </button>
          <button
            onClick={() => setActiveTab('history')}
            class={`px-4 py-2 text-sm font-medium ${activeTab() === 'history' 
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            History
          </button>
        </div>
        
        <Show when={activeTab() === 'generate'}>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column - Generation Controls */}
            <div class="md:col-span-2 space-y-6">
              <form onSubmit={handleSubmit} class="space-y-4">
                {/* Prompt Input */}
                <div>
                  <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Describe your icon:
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt()}
                    onInput={(e) => setPrompt(e.currentTarget.value)}
                    class="w-full text-base p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors duration-150 ease-in-out min-h-[80px] resize-y"
                    rows="3"
                    placeholder="e.g., A glossy red apple with a metallic stem"
                    disabled={generationMutation.isPending}
                  />
                </div>
                
                {/* Quick Prompts */}
                <div>
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Prompts:</h3>
                  <div class="flex flex-wrap gap-2">
                    <For each={quickPrompts()}>
                      {(quickPrompt) => (
                        <button
                          type="button"
                          onClick={() => handleQuickPromptSelect(quickPrompt)}
                          class="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          disabled={generationMutation.isPending}
                        >
                          {quickPrompt.name}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
                
                {/* Style Options */}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Material */}
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Material:
                    </label>
                    <Select
                      defaultValue={selectedMaterial()}
                      onChange={(val) => val && setSelectedMaterial(val)}
                      options={materials.map(m => m.id)}
                      placeholder="Select material"
                      itemComponent={props => (
                        <SelectItem item={props.item}>
                          {materials.find(m => m.id === props.item.rawValue)?.name}
                        </SelectItem>
                      )}
                      disabled={generationMutation.isPending}
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue>{state => 
                          materials.find(m => m.id === state.selectedOption())?.name || "Select material"
                        }</SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </div>
                  
                  {/* Angle/Perspective */}
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Perspective:
                    </label>
                    <Select
                      defaultValue={selectedAngle()}
                      onChange={(val) => val && setSelectedAngle(val)}
                      options={angles.map(a => a.id)}
                      placeholder="Select perspective"
                      itemComponent={props => (
                        <SelectItem item={props.item}>
                          {angles.find(a => a.id === props.item.rawValue)?.name}
                        </SelectItem>
                      )}
                      disabled={generationMutation.isPending}
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue>{state => 
                          angles.find(a => a.id === state.selectedOption())?.name || "Select perspective"
                        }</SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </div>
                  
                  {/* Size */}
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Size:
                    </label>
                    <Select
                      defaultValue={selectedSize()}
                      onChange={(val) => val && setSelectedSize(val)}
                      options={sizes.map(s => s.id)}
                      placeholder="Select size"
                      itemComponent={props => (
                        <SelectItem item={props.item}>
                          {sizes.find(s => s.id === props.item.rawValue)?.name}
                        </SelectItem>
                      )}
                      disabled={generationMutation.isPending}
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue>{state => 
                          sizes.find(s => s.id === state.selectedOption())?.name || "Select size"
                        }</SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={generationMutation.isPending}
                  variant="skeuomorphic"
                  class="w-full flex !cursor-pointer justify-center py-3 px-4 border-2 rounded-md"
                >
                  {generationMutation.isPending ? (
                    <>
                      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {streamMessage() || 'Generating...'}
                    </>
                  ) : (
                    'Generate Icon'
                  )}
                </Button>
              </form>
            </div>
            
            {/* Right Column - Preview */}
            <div class="flex flex-col space-y-4">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Preview:</h3>
              <div class="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex-grow bg-gray-50 dark:bg-gray-700/30">
                <Show when={generationMutation.isPending && !generatedImageUrl() && streamMessage() !== 'Image update received...' && streamMessage() !== 'Stream processing complete.'}>
                  <p class="text-gray-500 dark:text-gray-400">{streamMessage() || 'Your icon will appear here...'}</p>
                </Show>

                <Show when={generationMutation.error && !generationMutation.isPending}>
                  <div class="text-center">
                    <p class="text-red-600 dark:text-red-400 font-medium">Error generating icon:</p>
                    <p class="text-red-500 dark:text-red-500 text-sm">{generationMutation.error?.message}</p>
                  </div>
                </Show>

                {/* Display image if URL exists, regardless of pending status, to show live updates */}
                <Show when={generatedImageUrl() && !generationMutation.error}>
                  <div class="flex flex-col items-center">
                    <img 
                      src={generatedImageUrl()!} 
                      alt="Generated skeuomorphic icon" 
                      class="max-w-full max-h-64 object-contain rounded-md shadow-lg border border-gray-200 dark:border-gray-700 mb-4"
                    />
                    {/* Show download button only when mutation is not pending (i.e., stream likely finished or errored) */}
                    <Show when={!generationMutation.isPending && generatedImageUrl()}>
                      <div class="flex gap-2">
                        <Button variant="skeuomorphic" class="!bg-gradient-to-b !from-green-400 !via-green-500 !to-green-600 !border-green-600 !text-white">
                        <a 
                          href={generatedImageUrl()!} 
                          download={`icon-${prompt().substring(0,20).replace(/\s+/g, '-') || 'generated'}.png`}
                          class="text-xs font-medium"
                        >
                          Download
                        </a>
                        </Button>
                        <Button
                          onClick={() => {
                            const currentImage = generatedImageUrl();
                            const currentPrompt = prompt();
                            if (currentImage && currentPrompt) {
                              const newIcon = {
                                id: Date.now().toString(),
                                imageUrl: currentImage,
                                prompt: currentPrompt,
                                timestamp: Date.now()
                              };
                              toggleFavorite(newIcon);
                            }
                          }}
                          variant="skeuomorphic"
                          class="!bg-gradient-to-b !from-blue-400 !via-blue-500 !to-blue-600 !border-blue-600 !text-white"
                        >
                          Save to Favorites
                        </Button>
                      </div>
                    </Show>
                  </div>
                </Show>
                
                <Show when={!generationMutation.isPending && !generatedImageUrl() && !generationMutation.error && !streamMessage()}>
                  <p class="text-gray-500 dark:text-gray-400">Enter a prompt above and click "Generate Icon".</p>
                </Show>
              </div>
              
              {/* Enhanced prompt preview */}
              <Show when={prompt().trim() && !generationMutation.isPending}>
                <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-200 dark:border-gray-700">
                  <p class="font-medium mb-1">Final prompt:</p>
                  <p>{getEnhancedPrompt()}</p>
                </div>
              </Show>
            </div>
          </div>
        </Show>
        
        {/* History Tab */}
        <Show when={activeTab() === 'history'}>
          <div class="space-y-6">
            {/* Sub tabs for History */}
            <div class="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {}}
                class="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              >
                Recent ({iconHistory().length})
              </button>
              <button
                onClick={() => {}}
                class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Favorites ({favorites().length})
              </button>
            </div>
            
            {/* History Grid */}
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <For each={iconHistory()}>
                {(icon) => (
                  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div class="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                      <img 
                        src={icon.imageUrl} 
                        alt={icon.prompt} 
                        class="w-full h-full object-contain p-2"
                      />
                    </div>
                    <div class="p-2">
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate" title={icon.prompt}>
                        {icon.prompt.length > 30 ? `${icon.prompt.substring(0, 30)}...` : icon.prompt}
                      </p>
                      <div class="flex justify-between mt-2">
                        <button
                          onClick={() => toggleFavorite(icon)}
                          class="text-xs text-gray-500 hover:text-yellow-500"
                          title={favorites().some(f => f.id === icon.id) ? "Remove from favorites" : "Add to favorites"}
                        >
                          {favorites().some(f => f.id === icon.id) ? "★" : "☆"}
                        </button>
                        <button
                          onClick={() => downloadIcon(icon)}
                          class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Download"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
              
              <Show when={iconHistory().length === 0}>
                <div class="col-span-full text-center py-10">
                  <p class="text-gray-500 dark:text-gray-400">No history yet. Generate some icons first!</p>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default SkeuIcongenPage; 