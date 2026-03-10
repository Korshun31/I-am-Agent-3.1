'use client'

import { useState } from 'react'

export default function DashboardPage() {
  const [expandedSections, setExpandedSections] = useState({ admin: true, contacts: true })

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-8">
          <span className="text-lg font-semibold text-gray-800">I am Agent</span>
          <nav className="flex gap-6 text-sm text-gray-600">
            <a href="#" className="hover:text-gray-900">Недвижимость</a>
            <a href="#" className="hover:text-gray-900">Контакты</a>
            <a href="#" className="hover:text-gray-900">Бронирования</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Сообщения">💬</button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Уведомления">🔔</button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg text-lg font-medium" title="Добавить">+</button>
          <span className="text-sm text-gray-500">RU | EN</span>
        </div>
      </header>

      <div className="flex pt-14 w-full">
        {/* Sidebar */}
        <aside className="w-60 min-h-[calc(100vh-3.5rem)] bg-white border-r border-gray-200 flex-shrink-0">
          <nav className="p-3">
            <a href="#" className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 bg-[#E3F2FD] text-[#1976D2] font-medium">
              Мой профиль
            </a>

            <div className="mt-2">
              <button
                onClick={() => toggleSection('admin')}
                className="w-full flex items-center justify-between px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg text-left"
              >
                <span className="font-medium">Админ панель</span>
                <span className="text-gray-400">{expandedSections.admin ? '▼' : '▶'}</span>
              </button>
              {expandedSections.admin && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                  <a href="#" className="block py-1.5 px-2 text-sm text-gray-600 hover:text-gray-900">База домов</a>
                  <a href="#" className="block py-1.5 px-2 text-sm text-gray-600 hover:text-gray-900">Резорты</a>
                  <a href="#" className="block py-1.5 px-2 text-sm text-gray-600 hover:text-gray-900">Кондо</a>
                  <a href="#" className="block py-1.5 px-2 text-sm text-[#1976D2] font-medium">Добавить объект</a>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button
                onClick={() => toggleSection('contacts')}
                className="w-full flex items-center justify-between px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg text-left"
              >
                <span className="font-medium">База контактов</span>
                <span className="text-gray-400">{expandedSections.contacts ? '▼' : '▶'}</span>
              </button>
              {expandedSections.contacts && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                  <a href="#" className="block py-1.5 px-2 text-sm text-gray-600 hover:text-gray-900">Собственники</a>
                  <a href="#" className="block py-1.5 px-2 text-sm text-gray-600 hover:text-gray-900">Клиенты</a>
                </div>
              )}
            </div>

            <a href="#" className="flex items-center gap-2 px-3 py-2.5 mt-2 text-gray-700 hover:bg-gray-50 rounded-lg">
              Бронирования
            </a>
            <a href="#" className="flex items-center gap-2 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg">
              Календарь
            </a>
            <a href="#" className="flex items-center gap-2 px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg">
              Локации
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl space-y-6">
            {/* Profile Card */}
            <section className="bg-white rounded-lg border border-gray-200 p-5 relative">
              <button className="absolute top-4 right-4 px-3 py-1.5 text-sm font-medium text-[#1976D2] border border-[#1976D2] rounded-lg hover:bg-[#E3F2FD]">
                Редактировать
              </button>
              <div className="flex gap-5">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-400 flex-shrink-0">
                  👤
                </div>
                <div className="space-y-2">
                  <p><span className="text-gray-500 w-28 inline-block">Name:</span> Агент</p>
                  <p><span className="text-gray-500 w-28 inline-block">Location:</span> —</p>
                  <p><span className="text-gray-500 w-28 inline-block">E-Mail:</span> —</p>
                  <p><span className="text-gray-500 w-28 inline-block">Phone:</span> —</p>
                  <p><span className="text-gray-500 w-28 inline-block">Password:</span> **********</p>
                </div>
              </div>
            </section>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Объектов</p>
                <p className="text-2xl font-semibold text-gray-800 mt-1">—</p>
              </section>
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Контактов</p>
                <p className="text-2xl font-semibold text-gray-800 mt-1">—</p>
              </section>
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Активных бронирований</p>
                <p className="text-2xl font-semibold text-gray-800 mt-1">—</p>
              </section>
            </div>

            {/* Calendar */}
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="font-medium text-gray-800 mb-4">Календарь событий</h3>
              <div className="flex gap-8 overflow-x-auto pb-2">
                {['Ноябрь 2025', 'Декабрь 2025', 'Январь 2026'].map((month) => (
                  <div key={month} className="flex-shrink-0 min-w-[200px]">
                    <p className="text-sm font-medium text-gray-700 mb-2">{month}</p>
                    <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                        <span key={d} className="py-1 text-gray-500">{d}</span>
                      ))}
                      {Array.from({ length: 35 }, (_, i) => (
                        <span
                          key={i}
                          className={`py-1 rounded ${
                            [13, 19].includes(i) ? 'bg-red-100 text-red-600 font-medium' : [20, 26].includes(i) ? 'ring-1 ring-orange-300' : ''
                          }`}
                        >
                          {i < 30 ? i + 1 : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Upcoming Events Table */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-800">Ближайшие события</h3>
                <p className="text-sm text-gray-500 mt-0.5">События на ближайшие дни</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Дата</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Событие</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Номер брони</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Клиент</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Объект</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bookings / Applications Table */}
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Бронирования</h3>
                <button className="text-sm text-[#1976D2] font-medium hover:underline">+ Добавить</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Дата</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Клиент</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Объект</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Заезд</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Выезд</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                      <td className="px-5 py-3 text-gray-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
