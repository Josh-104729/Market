import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faTwitter, faLinkedin, faInstagram, faGithub } from '@fortawesome/free-brands-svg-icons'
import { useAppSelector } from '../store/hooks'

function Footer() {
  const currentYear = new Date().getFullYear()
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  return (
    <footer className="border-t border-white/5 bg-black/20 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-white/10 group-hover:scale-110 transition-transform">
                <span className="text-white font-bold text-xl">O</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-white">OmniMart</span>
              </div>
            </Link>
            <p className="text-neutral-400 font-light max-w-sm leading-relaxed">
              Anyone can sell anything and buy anything. Your universal marketplace for everything.
            </p>
            {/* Social Media Links */}
            <div className="flex items-center gap-4 mt-6">
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-primary transition-all"
                aria-label="Facebook"
              >
                <FontAwesomeIcon icon={faFacebook} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-primary transition-all"
                aria-label="Twitter"
              >
                <FontAwesomeIcon icon={faTwitter} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-primary transition-all"
                aria-label="LinkedIn"
              >
                <FontAwesomeIcon icon={faLinkedin} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-primary transition-all"
                aria-label="Instagram"
              >
                <FontAwesomeIcon icon={faInstagram} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-primary transition-all"
                aria-label="GitHub"
              >
                <FontAwesomeIcon icon={faGithub} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          {isAuthenticated && (
            <div>
              <h3 className="font-bold text-white text-sm mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    All Services
                  </Link>
                </li>
                <li>
                  <Link to="/feed" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    Feed
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    Profile
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Services */}
          {isAuthenticated && (
            <div>
              <h3 className="font-bold text-white text-sm mb-4">Services</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/services" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    Browse Services
                  </Link>
                </li>
                <li>
                  <Link to="/services/new" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    Create Service
                  </Link>
                </li>
                <li>
                  <Link to="/my-services" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                    My Services
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Support */}
          <div>
            <h3 className="font-bold text-white text-sm mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-neutral-400 hover:text-primary transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 text-center text-neutral-500 text-xs">
          <p>© {currentYear} OmniMart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

