{/* Video Production Template */}
{watchedValues.invoiceTemplate === 'video-production' && (
  <div style={{ 
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    position: 'relative',
    overflow: 'hidden'
  }}>
    {/* Red top border gradient */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '8px',
      background: 'linear-gradient(90deg, #e50914, #ff4757)'
    }}></div>

    {/* Header */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '2.5rem',
      paddingTop: '3rem',
      borderBottom: '1px solid #e0e0e0'
    }}>
      <div>
        <h1 style={{
          fontSize: '2rem',
          color: '#1a1a1a',
          marginBottom: '0.5rem',
          fontWeight: '700',
          margin: 0
        }}>{watchedValues.businessName || "LUMINA FILMS"}</h1>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: '0.5rem 0' }}>Cinematic storytelling at its finest</p>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: '0' }}>{watchedValues.businessAddress || "123 Film Lane, Studio City, CA 91604"}</p>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: '0' }}>{watchedValues.businessEmail || "contact@luminafilms.example"} | {watchedValues.businessPhone || "(555) 123-4567"}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '1.3rem',
          color: '#e50914',
          marginBottom: '0.5rem',
          fontWeight: '600'
        }}>INV #LF-{watchedValues.nextInvoiceNumber || '2023-108'}</div>
        <div style={{ color: '#666', fontSize: '0.9rem', margin: '0.2rem 0' }}>Date: {new Date().toLocaleDateString()}</div>
        <div style={{ color: '#666', fontSize: '0.9rem', margin: '0' }}>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
      </div>
    </div>

    {/* Billing Information */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '2rem',
      padding: '2rem 2.5rem',
      background: '#f9f9f9'
    }}>
      <div>
        <h3 style={{
          color: '#e50914',
          marginBottom: '1rem',
          fontSize: '1.1rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: '600',
          margin: '0 0 1rem 0'
        }}>Bill To</h3>
        <div>
          <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Sample Client</p>
          <p style={{ margin: '0 0 0.5rem 0' }}>123 Business Ave</p>
          <p style={{ margin: '0 0 0.5rem 0' }}>Business City, ST 12345</p>
          <p style={{ margin: '0' }}>client@example.com</p>
        </div>
      </div>
      <div>
        <h3 style={{
          color: '#e50914',
          marginBottom: '1rem',
          fontSize: '1.1rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: '600',
          margin: '0 0 1rem 0'
        }}>Project Details</h3>
        <div>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong>Project:</strong> Video Production Project</p>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong>Project ID:</strong> PRJ-VP-001</p>
          <p style={{ margin: '0' }}><strong>Production Dates:</strong> Current Month</p>
        </div>
      </div>
    </div>

    {/* Filmstrip Divider */}
    <div style={{
      height: '20px',
      background: 'repeating-linear-gradient(90deg, #1a1a1a, #1a1a1a 10px, transparent 10px, transparent 30px)',
      margin: '0 2.5rem',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-20px',
        width: '20px',
        height: '100%',
        background: '#1a1a1a',
        borderRadius: '10px 0 0 10px'
      }}></div>
      <div style={{
        position: 'absolute',
        top: 0,
        right: '-20px',
        width: '20px',
        height: '100%',
        background: '#1a1a1a',
        borderRadius: '0 10px 10px 0'
      }}></div>
    </div>

    {/* Services Table */}
    <table style={{
      width: 'calc(100% - 5rem)',
      margin: '2rem 2.5rem',
      borderCollapse: 'collapse'
    }}>
      <thead>
        <tr>
          <th style={{
            textAlign: 'left',
            padding: '1rem',
            background: '#f9f9f9',
            color: '#1a1a1a',
            fontWeight: '600',
            borderBottom: '2px solid #e0e0e0',
            width: '50%'
          }}>Service</th>
          <th style={{
            textAlign: 'left',
            padding: '1rem',
            background: '#f9f9f9',
            color: '#1a1a1a',
            fontWeight: '600',
            borderBottom: '2px solid #e0e0e0'
          }}>Days/Qty</th>
          <th style={{
            textAlign: 'left',
            padding: '1rem',
            background: '#f9f9f9',
            color: '#1a1a1a',
            fontWeight: '600',
            borderBottom: '2px solid #e0e0e0'
          }}>Rate</th>
          <th style={{
            textAlign: 'left',
            padding: '1rem',
            background: '#f9f9f9',
            color: '#1a1a1a',
            fontWeight: '600',
            borderBottom: '2px solid #e0e0e0'
          }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{
            padding: '1rem',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold' }}>Pre-Production</div>
            <div style={{
              color: '#e50914',
              fontWeight: '500',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Creative Development</div>
          </td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>5</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$1,200.00</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$6,000.00</td>
        </tr>
        <tr>
          <td style={{
            padding: '1rem',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold' }}>Principal Photography</div>
            <div style={{
              color: '#e50914',
              fontWeight: '500',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>2 Camera Crew</div>
          </td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>3</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$3,500.00</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$10,500.00</td>
        </tr>
        <tr>
          <td style={{
            padding: '1rem',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold' }}>Cinematography</div>
            <div style={{
              color: '#e50914',
              fontWeight: '500',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>ARRI Alexa Package</div>
          </td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>3</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$2,800.00</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$8,400.00</td>
        </tr>
        <tr>
          <td style={{
            padding: '1rem',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold' }}>Post-Production</div>
            <div style={{
              color: '#e50914',
              fontWeight: '500',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Editing & Color Grading</div>
          </td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>10</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$950.00</td>
          <td style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>$9,500.00</td>
        </tr>
        <tr>
          <td style={{ padding: '1rem', borderBottom: 'none' }}>
            <div style={{ fontWeight: 'bold' }}>Licensed Music Track</div>
            <div style={{
              color: '#e50914',
              fontWeight: '500',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>"Neon Dreams" by AudioNetwork</div>
          </td>
          <td style={{ padding: '1rem', borderBottom: 'none' }}>1</td>
          <td style={{ padding: '1rem', borderBottom: 'none' }}>$1,200.00</td>
          <td style={{ padding: '1rem', borderBottom: 'none' }}>$1,200.00</td>
        </tr>
      </tbody>
    </table>

    {/* Totals */}
    <div style={{
      margin: '2rem 2.5rem',
      paddingTop: '1rem',
      borderTop: '2px dashed #e0e0e0'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.8rem'
      }}>
        <span>Subtotal:</span>
        <span>$35,600.00</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.8rem'
      }}>
        <span>Equipment Discount (10%):</span>
        <span style={{ color: '#ff6b6b' }}>-$3,560.00</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.8rem'
      }}>
        <span>Tax (8.5%):</span>
        <span>$2,723.40</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: '700',
        color: '#e50914',
        fontSize: '1.2rem',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '2px dashed #e0e0e0'
      }}>
        <span>TOTAL DUE:</span>
        <span>$34,763.40</span>
      </div>
    </div>

    {/* Payment Notes */}
    <div style={{
      padding: '0 2.5rem 2rem',
      color: '#666',
      fontSize: '0.9rem'
    }}>
      <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: '#1a1a1a' }}>Payment Terms:</strong> Net 30. Late fees of 1.5% monthly will apply after due date.</p>
      <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: '#1a1a1a' }}>Payment Methods:</strong> Bank transfer, check, or credit card (+3% fee).</p>
      <p style={{ margin: '0' }}><strong style={{ color: '#1a1a1a' }}>Bank Details:</strong> Chase Bank | Routing #021000021 | Account #987654321</p>
    </div>

    {/* Footer */}
    <div style={{
      padding: '2rem 2.5rem',
      background: '#f9f9f9',
      textAlign: 'center',
      color: '#666',
      fontSize: '0.9rem'
    }}>
      <p style={{ margin: '0 0 0.5rem 0' }}>Thank you for choosing <strong>Lumina Films</strong>!</p>
      <p style={{ margin: '0 0 0.5rem 0' }}>Questions? Email <span style={{ color: '#e50914', fontWeight: '500' }}>accounting@luminafilms.example</span></p>
      <p style={{ margin: '0' }}>© 2023 Lumina Films | All rights reserved</p>
    </div>
  </div>
)}