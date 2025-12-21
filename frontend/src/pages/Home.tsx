import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import { categoryApi, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { 
  Search, 
  ShieldCheck, 
  Rocket, 
  Users, 
  Wallet, 
  CheckCircle2, 
  ArrowRight, 
  Handshake, 
  Lock, 
  Clock, 
  Globe, 
  Store,
  Sparkles,
  Loader2
} from "lucide-react"

function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/services?search=${encodeURIComponent(searchQuery)}`)
    } else {
      navigate('/services')
    }
  }

  const features = [
    {
      icon: ShieldCheck,
      title: 'Secure Transactions',
      description: 'Bank-level encryption and secure payment processing for all transactions',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      icon: Rocket,
      title: 'Fast & Easy',
      description: 'Get started in minutes. List your service or find what you need instantly',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      icon: Users,
      title: 'Global Community',
      description: 'Connect with buyers and sellers from around the world',
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      icon: Wallet,
      title: 'Crypto Payments',
      description: 'Pay and get paid with USD. Fast, secure, and borderless',
      color: 'bg-orange-50 text-orange-600'
    },
    {
      icon: Handshake,
      title: 'Trusted Platform',
      description: 'Verified sellers and buyer protection on every transaction',
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      icon: Globe,
      title: 'Unlimited Categories',
      description: 'Sell or buy anything - from digital services to physical products',
      color: 'bg-pink-50 text-pink-600'
    }
  ]

  const howItWorks = [
    {
      step: 1,
      title: 'Sign Up Free',
      description: 'Create your account in seconds. No credit card required.',
      icon: Users
    },
    {
      step: 2,
      title: 'List or Browse',
      description: 'Sell your services or browse thousands of available listings.',
      icon: Store
    },
    {
      step: 3,
      title: 'Connect & Transact',
      description: 'Chat with buyers/sellers and complete secure transactions.',
      icon: Handshake
    },
    {
      step: 4,
      title: 'Get Paid',
      description: 'Receive payments instantly via USD. Withdraw anytime.',
      icon: Wallet
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-20 md:pt-32 md:pb-32 overflow-hidden bg-slate-50">
        <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/20 bg-primary/5 text-primary gap-2 text-sm rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            Join 50,000+ active users
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 leading-[1.1]">
            {isAuthenticated ? (
              <>Welcome back, <span className="text-primary">{user?.firstName || 'User'}</span>!</>
            ) : (
              <>Anyone can <span className="text-primary">sell</span> anything</>
            )}
            <br />
            <span className="text-slate-500">and </span>
            <span className="underline decoration-primary/30 underline-offset-8">buy anything</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 font-medium">
            Your universal marketplace. Sell digital services, physical products, or anything you can imagine. 
            Get paid instantly with USD.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-2xl mx-auto mb-12">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search for anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full h-14 pl-12 pr-4 rounded-full border-slate-200 bg-white shadow-sm focus-visible:ring-primary text-base"
              />
            </div>
            <Button 
              onClick={handleSearch}
              className="h-14 px-8 rounded-full font-bold text-base w-full sm:w-auto gap-2"
            >
              <Search className="w-5 h-5" /> Search
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-slate-500 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-primary" /> Secure Payments
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Verified Sellers
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" /> 24/7 Support
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-slate-100 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">50K+</div>
              <div className="text-slate-500 text-sm font-medium">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">10K+</div>
              <div className="text-slate-500 text-sm font-medium">Active Listings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">2K+</div>
              <div className="text-slate-500 text-sm font-medium">Verified Sellers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">98%</div>
              <div className="text-slate-500 text-sm font-medium">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-600 max-w-xl mx-auto">Get started in 4 simple steps. It's that easy!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step) => (
              <div key={step.step} className="relative group text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6 relative z-10 transition-transform group-hover:scale-110">
                  <step.icon className="w-8 h-8" />
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-white border-2 border-primary rounded-full flex items-center justify-center text-xs font-bold text-primary">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                {step.step < 4 && (
                  <div className="hidden lg:block absolute top-14 left-[calc(50%+4rem)] w-[calc(100%-8rem)] h-px bg-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Choose OmniMart</h2>
            <p className="text-slate-600 max-w-xl mx-auto">Everything you need to buy and sell with confidence</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-2`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600 text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Browse by Category</h2>
              <p className="text-slate-600">Explore thousands of listings across all categories</p>
            </div>
            <Button variant="outline" asChild className="hidden sm:flex rounded-full">
              <Link to="/services">View All <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No categories available</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/services?category=${category.id}`}
                  className="group"
                >
                  <div className="h-full p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-primary/20 hover:shadow-md transition-all flex flex-col items-center text-center gap-4">
                    {category.icon && (
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                        <div className="text-3xl text-primary grayscale group-hover:grayscale-0 transition-all">
                          {renderIcon(category.icon)}
                        </div>
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-primary transition-colors">
                        {category.title}
                      </h3>
                      {category.serviceCount !== undefined && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {category.serviceCount} {category.serviceCount === 1 ? 'listing' : 'listings'}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Home
