import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

interface ImageWithLoaderProps {
  src: string
  alt: string
  className?: string
  containerClassName?: string
  showBlurBackground?: boolean
  placeholder?: React.ReactNode
}

export default function ImageWithLoader({
  src,
  alt,
  className = '',
  containerClassName = '',
  showBlurBackground = true,
  placeholder,
}: ImageWithLoaderProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Preload the image to get blur effect working
  useEffect(() => {
    if (!src) {
      setError(true)
      setLoading(false)
      return
    }

    const img = new Image()
    img.src = src
    
    img.onload = () => {
      setImageLoaded(true)
      // Small delay to ensure blur background is rendered
      setTimeout(() => {
        setLoading(false)
      }, 100)
    }
    
    img.onerror = () => {
      setError(true)
      setLoading(false)
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  const handleLoad = () => {
    setLoading(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Blurred background - always shown when showBlurBackground is true */}
      {showBlurBackground && !error && src && (
        <div
          className={`absolute inset-0 bg-cover bg-center filter blur-xl scale-110 transition-opacity duration-500 ${
            loading ? 'opacity-60' : 'opacity-40'
          }`}
          style={{
            backgroundImage: `url(${src})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          {placeholder || (
            <div className="flex flex-col items-center space-y-3">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-blue-400" />
              <span className="text-sm text-neutral-300 font-medium">Loading image...</span>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error ? (
        <div className="w-full h-full flex items-center justify-center bg-neutral-700/80 backdrop-blur-sm">
          <div className="text-4xl">📦</div>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center z-10">
          <img
            src={src}
            alt={alt}
            className={`${className} transition-opacity duration-500 ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </div>
  )
}

