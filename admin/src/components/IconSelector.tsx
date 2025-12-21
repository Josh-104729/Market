import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import {
  faLaptopCode,
  faPalette,
  faChartLine,
  faPen,
  faVideo,
  faMobileAlt,
  faGlobe,
  faCamera,
  faMusic,
  faGamepad,
  faDumbbell,
  faUtensils,
  faHome,
  faCar,
  faPlane,
  faGraduationCap,
  faBriefcase,
  faHeart,
  faShoppingBag,
  faTools,
  faWrench,
  faPaintBrush,
  faCode,
  faDatabase,
  faCloud,
  faLock,
  faShield,
  faBell,
  faEnvelope,
  faPhone,
  faUser,
  faUsers,
  faFolder,
  faFile,
  faImage,
  faFilm,
  faBook,
  faNewspaper,
  faCalendar,
  faClock,
  faMapMarker,
  faSearch,
  faStar,
  faThumbsUp,
  faComment,
  faShare,
  faDownload,
  faUpload,
  faTrash,
  faEdit,
  faSave,
  faPlus,
  faMinus,
  faCheck,
  faTimes,
  faArrowRight,
  faArrowLeft,
  faBars,
  faCog,
  faQuestionCircle,
  faInfoCircle,
  faExclamationCircle,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons'

interface IconSelectorProps {
  selectedIcon?: string
  onSelect: (iconName: string) => void
}

const availableIcons: { name: string; icon: IconDefinition; label: string }[] = [
  { name: 'fa-laptop-code', icon: faLaptopCode, label: 'Laptop Code' },
  { name: 'fa-palette', icon: faPalette, label: 'Palette' },
  { name: 'fa-chart-line', icon: faChartLine, label: 'Chart Line' },
  { name: 'fa-pen', icon: faPen, label: 'Pen' },
  { name: 'fa-video', icon: faVideo, label: 'Video' },
  { name: 'fa-mobile-alt', icon: faMobileAlt, label: 'Mobile' },
  { name: 'fa-globe', icon: faGlobe, label: 'Globe' },
  { name: 'fa-camera', icon: faCamera, label: 'Camera' },
  { name: 'fa-music', icon: faMusic, label: 'Music' },
  { name: 'fa-gamepad', icon: faGamepad, label: 'Gamepad' },
  { name: 'fa-dumbbell', icon: faDumbbell, label: 'Dumbbell' },
  { name: 'fa-utensils', icon: faUtensils, label: 'Utensils' },
  { name: 'fa-home', icon: faHome, label: 'Home' },
  { name: 'fa-car', icon: faCar, label: 'Car' },
  { name: 'fa-plane', icon: faPlane, label: 'Plane' },
  { name: 'fa-graduation-cap', icon: faGraduationCap, label: 'Education' },
  { name: 'fa-briefcase', icon: faBriefcase, label: 'Briefcase' },
  { name: 'fa-heart', icon: faHeart, label: 'Heart' },
  { name: 'fa-shopping-bag', icon: faShoppingBag, label: 'Shopping' },
  { name: 'fa-tools', icon: faTools, label: 'Tools' },
  { name: 'fa-wrench', icon: faWrench, label: 'Wrench' },
  { name: 'fa-paint-brush', icon: faPaintBrush, label: 'Paint Brush' },
  { name: 'fa-code', icon: faCode, label: 'Code' },
  { name: 'fa-database', icon: faDatabase, label: 'Database' },
  { name: 'fa-cloud', icon: faCloud, label: 'Cloud' },
  { name: 'fa-lock', icon: faLock, label: 'Lock' },
  { name: 'fa-shield', icon: faShield, label: 'Shield' },
  { name: 'fa-bell', icon: faBell, label: 'Bell' },
  { name: 'fa-envelope', icon: faEnvelope, label: 'Envelope' },
  { name: 'fa-phone', icon: faPhone, label: 'Phone' },
  { name: 'fa-user', icon: faUser, label: 'User' },
  { name: 'fa-users', icon: faUsers, label: 'Users' },
  { name: 'fa-folder', icon: faFolder, label: 'Folder' },
  { name: 'fa-file', icon: faFile, label: 'File' },
  { name: 'fa-image', icon: faImage, label: 'Image' },
  { name: 'fa-film', icon: faFilm, label: 'Film' },
  { name: 'fa-book', icon: faBook, label: 'Book' },
  { name: 'fa-newspaper', icon: faNewspaper, label: 'Newspaper' },
  { name: 'fa-calendar', icon: faCalendar, label: 'Calendar' },
  { name: 'fa-clock', icon: faClock, label: 'Clock' },
  { name: 'fa-map-marker', icon: faMapMarker, label: 'Map Marker' },
  { name: 'fa-search', icon: faSearch, label: 'Search' },
  { name: 'fa-star', icon: faStar, label: 'Star' },
  { name: 'fa-thumbs-up', icon: faThumbsUp, label: 'Thumbs Up' },
  { name: 'fa-comment', icon: faComment, label: 'Comment' },
  { name: 'fa-share', icon: faShare, label: 'Share' },
  { name: 'fa-download', icon: faDownload, label: 'Download' },
  { name: 'fa-upload', icon: faUpload, label: 'Upload' },
  { name: 'fa-trash', icon: faTrash, label: 'Trash' },
  { name: 'fa-edit', icon: faEdit, label: 'Edit' },
  { name: 'fa-save', icon: faSave, label: 'Save' },
  { name: 'fa-plus', icon: faPlus, label: 'Plus' },
  { name: 'fa-minus', icon: faMinus, label: 'Minus' },
  { name: 'fa-check', icon: faCheck, label: 'Check' },
  { name: 'fa-times', icon: faTimes, label: 'Times' },
  { name: 'fa-arrow-right', icon: faArrowRight, label: 'Arrow Right' },
  { name: 'fa-arrow-left', icon: faArrowLeft, label: 'Arrow Left' },
  { name: 'fa-bars', icon: faBars, label: 'Bars' },
  { name: 'fa-cog', icon: faCog, label: 'Cog' },
  { name: 'fa-question-circle', icon: faQuestionCircle, label: 'Question' },
  { name: 'fa-info-circle', icon: faInfoCircle, label: 'Info' },
  { name: 'fa-exclamation-circle', icon: faExclamationCircle, label: 'Exclamation' },
  { name: 'fa-check-circle', icon: faCheckCircle, label: 'Check Circle' },
]

export default function IconSelector({ selectedIcon, onSelect }: IconSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredIcons = availableIcons.filter((item) =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedIconData = availableIcons.find((item) => item.name === selectedIcon)

  const handleSelect = (iconName: string) => {
    onSelect(iconName)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = () => {
    onSelect('')
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-neutral-300 mb-2">
        Icon
      </label>
      
      {/* Selected Icon Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-neutral-700 text-neutral-100 flex items-center justify-between hover:bg-neutral-600"
      >
        <div className="flex items-center space-x-3">
          {selectedIconData ? (
            <>
              <FontAwesomeIcon icon={selectedIconData.icon} className="text-2xl text-blue-400" />
              <span className="text-neutral-100">{selectedIconData.label}</span>
            </>
          ) : (
            <span className="text-neutral-400">Select an icon</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-neutral-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Icon Picker Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl max-h-96 overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 border-b border-neutral-700">
            <input
              type="text"
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Clear Button */}
          {selectedIcon && (
            <div className="px-3 py-2 border-b border-neutral-700">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-red-400 hover:text-red-300 font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* Icons Grid */}
          <div className="p-3 overflow-y-auto max-h-64">
            {filteredIcons.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                No icons found matching "{searchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {filteredIcons.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelect(item.name)}
                    className={`p-3 rounded-lg border-2 transition-all hover:bg-blue-900/30 hover:border-blue-500 ${
                      selectedIcon === item.name
                        ? 'bg-blue-900 border-blue-500'
                        : 'border-neutral-600'
                    }`}
                    title={item.label}
                  >
                    <FontAwesomeIcon
                      icon={item.icon}
                      className={`text-xl ${
                        selectedIcon === item.name ? 'text-blue-400' : 'text-neutral-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false)
            setSearchTerm('')
          }}
        />
      )}
    </div>
  )
}

