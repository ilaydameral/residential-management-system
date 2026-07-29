import { useEffect, useState, type FormEvent } from 'react'
import { API_BASE_URL } from './config'

type Property = {
  id: number
  name: string
  propertyType: string
  addressLine: string
  city: string
  district: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

type PropertyForm = {
  name: string
  propertyType: string
  addressLine: string
  city: string
  district: string
  description: string
}

const initialForm: PropertyForm = {
  name: '',
  propertyType: '',
  addressLine: '',
  city: '',
  district: '',
  description: '',
}

function App() {
  const [properties, setProperties] = useState<Property[]>([])
  const [form, setForm] = useState<PropertyForm>(initialForm)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/properties`,
        )

        if (!response.ok) {
          throw new Error('Properties could not be loaded.')
        }

        const data: Property[] = await response.json()
        setProperties(data)
      } catch {
        setErrorMessage('The property list could not be loaded.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperties()
  }, [])

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/properties`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        },
      )

      if (!response.ok) {
        throw new Error('Property could not be created.')
      }

      const createdProperty: Property = await response.json()

      setProperties((currentProperties) => [
        ...currentProperties,
        createdProperty,
      ])

      setForm(initialForm)
    } catch {
      setErrorMessage('The property could not be created.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
  <main className="page-shell">
    <header className="page-header">
      <p className="eyebrow">Phase 1 Prototype</p>
      <h1>Residential Management System</h1>
      <p className="page-description">
        Create and view properties through the React, ASP.NET Core
        and SQL Server workflow.
      </p>
    </header>

    <div className="content-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Add Property</h2>
          <p>Create a new apartment or residential complex record.</p>
        </div>

        <form className="property-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Property name</label>
            <input
              id="name"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Olbia Residence"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="propertyType">Property type</label>
            <input
              id="propertyType"
              value={form.propertyType}
              onChange={(event) =>
                setForm({
                  ...form,
                  propertyType: event.target.value,
                })
              }
              placeholder="Apartment Building"
              required
            />
          </div>

          <div className="form-field form-field-full">
            <label htmlFor="addressLine">Address</label>
            <input
              id="addressLine"
              value={form.addressLine}
              onChange={(event) =>
                setForm({
                  ...form,
                  addressLine: event.target.value,
                })
              }
              placeholder="Street, building number"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="city">City</label>
            <input
              id="city"
              value={form.city}
              onChange={(event) =>
                setForm({
                  ...form,
                  city: event.target.value,
                })
              }
              placeholder="İzmir"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="district">District</label>
            <input
              id="district"
              value={form.district}
              onChange={(event) =>
                setForm({
                  ...form,
                  district: event.target.value,
                })
              }
              placeholder="Konak"
              required
            />
          </div>

          <div className="form-field form-field-full">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
              placeholder="Optional property description"
              rows={4}
            />
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Add property'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Properties</h2>
          <p>{properties.length} property records found.</p>
        </div>

        {isLoading && <p className="status-message">Loading...</p>}

        {errorMessage && (
          <p className="status-message error-message">
            {errorMessage}
          </p>
        )}

        {!isLoading &&
          !errorMessage &&
          properties.length === 0 && (
            <p className="status-message">
              No properties found.
            </p>
          )}

        <div className="property-list">
          {properties.map((property) => (
            <article className="property-card" key={property.id}>
              <div className="property-card-header">
                <div>
                  <h3>{property.name}</h3>
                  <p className="property-type">
                    {property.propertyType}
                  </p>
                </div>

                <span
                  className={
                    property.isActive
                      ? 'status-badge active'
                      : 'status-badge inactive'
                  }
                >
                  {property.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="property-location">
                {property.city} / {property.district}
              </p>

              <p>{property.addressLine}</p>

              {property.description && (
                <p className="property-description">
                  {property.description}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  </main>
)
}

export default App
