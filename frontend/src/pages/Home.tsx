import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faPalette, faChartLine, faPen, faVideo, faMobileAlt, faStar, faSearch } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

function Home() {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryApi.getAll()
        setCategories(data)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const featuredServices = [
    { id: 1, title: 'Professional Website Design', price: '$299', rating: 4.9, reviews: 127, icon: faGlobe },
    { id: 2, title: 'Logo Design Package', price: '$99', rating: 4.8, reviews: 89, icon: faPalette },
    { id: 3, title: 'SEO Optimization', price: '$199', rating: 4.7, reviews: 156, icon: faChartLine },
    { id: 4, title: 'Content Writing', price: '$49', rating: 4.9, reviews: 203, icon: faPen },
    { id: 5, title: 'Video Editing', price: '$149', rating: 4.6, reviews: 67, icon: faVideo },
    { id: 6, title: 'Social Media Management', price: '$179', rating: 4.8, reviews: 134, icon: faMobileAlt },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 md:pt-40 pb-20 overflow-hidden">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="block text-white">
              {isAuthenticated ? `Welcome back, ${user?.firstName || 'User'}!` : 'Find the Perfect Service'}
            </span>
            <span className="block mt-2">
              <span className="text-slate-300">for Your </span>
              <span className="text-gradient-primary">Business</span>
              <span className="text-white">.</span>
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-4 font-light leading-relaxed">
            Connect with talented professionals and get your projects done
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto mb-10">
            <div className="relative flex-1 w-full">
              <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search for services..."
                className="w-full pl-12 pr-4 py-4 glass-card rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <button className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all flex items-center space-x-2 whitespace-nowrap">
              <FontAwesomeIcon icon={faSearch} />
              <span>Search</span>
            </button>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 border-t border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-center">
            <span className="text-white">Browse by </span>
            <span className="text-gradient-primary">Category</span>
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No categories available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="glass-card p-6 rounded-2xl hover:border-primary/20 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    {category.icon && (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/10 flex items-center justify-center">
                        <div className="text-3xl text-primary">
                          {renderIcon(category.icon)}
                        </div>
                      </div>
                    )}
                    <h3 className="font-semibold text-white">
                      {category.title}
                    </h3>
                    {category.serviceCount !== undefined && (
                      <p className="text-sm text-slate-400">
                        {category.serviceCount} {category.serviceCount === 1 ? 'service' : 'services'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-24 border-t border-white/5 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-center">
            <span className="text-white">Featured </span>
            <span className="text-gradient-primary">Services</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredServices.map((service) => (
              <div
                key={service.id}
                className="glass-card rounded-2xl overflow-hidden hover:border-primary/20 transition-all hover:scale-[1.02]"
              >
                <div className="h-48 bg-gradient-to-br from-primary/10 to-emerald-900/5 flex items-center justify-center">
                  <FontAwesomeIcon icon={service.icon} className="text-6xl text-primary" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{service.title}</h3>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
                      <span className="font-semibold text-white">{service.rating}</span>
                      <span className="text-slate-400 text-sm">({service.reviews})</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">{service.price}</span>
                  </div>
                  <button className="w-full py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1 transition-all">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">10K+</div>
              <div className="text-slate-400">Active Services</div>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">5K+</div>
              <div className="text-slate-400">Happy Clients</div>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">2K+</div>
              <div className="text-slate-400">Expert Sellers</div>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-4xl md:text-5xl font-bold mb-2 text-primary">98%</div>
              <div className="text-slate-400">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home

