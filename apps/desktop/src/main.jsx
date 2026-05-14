import React from 'react'
import { createRoot } from 'react-dom/client'
import Shell from './shell/Shell.jsx'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/base.css'
import './styles/atoms.css'
import './styles/shell.css'

createRoot(document.getElementById('root')).render(<Shell />)
