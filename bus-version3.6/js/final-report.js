(function () {
  'use strict';

  let currentUser = null;
  let allExpenses = [];
  let blockProductionEntries = [];
  let sandEntries = [];
  let groupedExpenses = {};

  const FALLBACK_GROUPS = {
    'Accommodation': [
      'Hotel Accommodation',
      'House Rent',
      'House Cleaning',
      'House Setup Materials'
    ],

    'Block Production': [
      'Store Construction',
      'Cement',
      'Burnt Bricks',
      'Water Supply',
      'Sharp Sand',
      'plaster Sand',
      'Plaster Sand',
      'Block Moulding Labour',
      'Block Production'
    ],

    'Main Work': [
      'Chemical',
      'Setting Out Materials',
      'Security',
      'PPE & Safety Equipment',
      'Granite',
      'Site Office'
    ],

    'Excavation of Trenches': [
      'Excavation of Trenches',
      'Excavation Equipment Hire'
    ],

    'Concrete Works': [
      'Column Blinding',
      'Column Base',
      'Trenches Casting',
      'Columns Before Slab',
      'Slab',
      'Kickers',
      'Column on Slab',
      'Lintel',
      'Beams & First Floor Slab',
      'First Floor Columns',
      'First Floor Lintel',
      'Roof Beam',
      'Mason/Poker Labour',
      'Poker Rental',
      'Bentonite',
      'Block Setting',
      'Hollow Filling'
    ],

    'Transportation of Tools': [
      'Transportation of Tools',
      'Fuel for Transportation'
    ],

    'Ach Shittu Materials': [
      'Ach Shittu Materials (Bulk Purchase)'
    ],

    'Workmanship': [
      'Mason',
      'Carpenter',
      'Electrician',
      'Plumber',
      'Welder',
      'Painter',
      'General Labour',
      'Workmanship (Other)'
    ],

    'Other Expenses': [
      'Iron Rods',
      'Timber',
      'Roofing Materials',
      'Paint',
      'Tiles',
      'Plumbing Materials',
      'Electrical Materials',
      'Doors & Windows',
      'Glass & Aluminium',
      'Blocks',
      'Bricks',
      'Generator Fuel',
      'Diesel',
      'Petrol',
      'Internet & Communication',
      'Equipment Hire',
      'Machinery Repair',
      'Tool Purchase',
      'Haulage',
      'Loading & Offloading',
      'Site Cleaning',
      'Office Supplies',
      'Waste Disposal',
      'Miscellaneous'
    ]
  };

  const GROUPS =
    typeof CATEGORY_GROUPS !== 'undefined'
      ? CATEGORY_GROUPS
      : FALLBACK_GROUPS;

  const GROUP_ORDER = Object.keys(GROUPS);

  const GROUP_OF = {};

  GROUP_ORDER.forEach(function (group) {
    (GROUPS[group] || []).forEach(function (category) {
      GROUP_OF[category] = group;
    });
  });

  function money(value) {
    return (
      '₦' +
      Number(value || 0).toLocaleString(
        undefined,
        {
          maximumFractionDigits: 2
        }
      )
    );
  }

  function clean(value) {
    return String(
      value == null ? '' : value
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const text =
      String(value).trim();

    if (!text) {
      return null;
    }

    const match =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    }

    const d =
      new Date(text);

    return isNaN(d.getTime())
      ? null
      : d;
  }

  function formatDate(value) {
    const d =
      parseDate(value);

    if (!d) {
      return String(
        value || '—'
      );
    }

    return d.toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    );
  }

  function getMonthKey(value) {
    const d =
      parseDate(value);

    if (!d) {
      return 'Unknown';
    }

    return d.toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'short'
      }
    );
  }

  function showToast(
    message,
    type
  ) {
    const toast =
      document.getElementById(
        'toast'
      );

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.className =
      'toast show ' +
      (type || '');

    setTimeout(
      function () {
        toast.classList.remove(
          'show'
        );
      },
      3500
    );
  }

  function groupData() {
    groupedExpenses = {};

    GROUP_ORDER.forEach(
      function (group) {
        groupedExpenses[group] = [];
      }
    );

    if (
      !groupedExpenses[
        'Other Expenses'
      ]
    ) {
      groupedExpenses[
        'Other Expenses'
      ] = [];
    }

    allExpenses.forEach(
      function (expense) {
        const category =
          String(
            expense.Category || ''
          ).trim();

        const group =
          GROUP_OF[category] ||
          'Other Expenses';

        if (
          !groupedExpenses[group]
        ) {
          groupedExpenses[group] = [];
        }

        groupedExpenses[group].push(
          expense
        );
      }
    );

    Object.keys(
      groupedExpenses
    ).forEach(
      function (group) {
        groupedExpenses[group].sort(
          function (a, b) {
            const da =
              parseDate(a.Date);

            const db =
              parseDate(b.Date);

            if (!da || !db) {
              return 0;
            }

            return da - db;
          }
        );
      }
    );
  }

  function totalRows(rows) {
    return (
      rows || []
    ).reduce(
      function (
        sum,
        row
      ) {
        return (
          sum +
          (
            Number(
              row.Amount
            ) || 0
          )
        );
      },
      0
    );
  }

  function renderSummary() {
    const body =
      document.getElementById(
        'summaryRows'
      );

    if (!body) {
      return;
    }

    const grandTotal =
      totalRows(
        allExpenses
      );

    body.innerHTML =
      GROUP_ORDER
        .map(
          function (group) {
            const rows =
              groupedExpenses[
                group
              ] || [];

            const total =
              totalRows(rows);

            const pct =
              grandTotal > 0
                ? (
                    total /
                    grandTotal
                  ) * 100
                : 0;

            return `
              <tr>
                <td>
                  ${clean(group)}
                </td>

                <td>
                  <strong>
                    ${money(total)}
                  </strong>
                </td>

                <td>
                  ${pct.toFixed(1)}%
                </td>
              </tr>
            `;
          }
        )
        .join('');

    const grand =
      document.getElementById(
        'grandTotal'
      );

    if (grand) {
      grand.textContent =
        money(grandTotal);
    }

    const foundation =
      document.getElementById(
        'foundationSubtotal'
      );

    if (foundation) {
      foundation.textContent =
        money(
          totalRows(
            groupedExpenses[
              'Excavation of Trenches'
            ] || []
          ) +
          totalRows(
            groupedExpenses[
              'Concrete Works'
            ] || []
          )
        );
    }

    const meta =
      document.getElementById(
        'reportMeta'
      );

    if (meta) {
      let latest = null;

      allExpenses.forEach(
        function (expense) {
          const d =
            parseDate(
              expense.Date
            );

          if (
            d &&
            (
              !latest ||
              d > latest
            )
          ) {
            latest = d;
          }
        }
      );

      meta.textContent =
        allExpenses.length +
        ' transactions · data through ' +
        (
          latest
            ? formatDate(latest)
            : '—'
        ) +
        ' · generated ' +
        new Date()
          .toLocaleDateString();
    }
  }

  function renderByPeriod() {
    const head =
      document.getElementById(
        'byPeriodHead'
      );

    const body =
      document.getElementById(
        'byPeriodRows'
      );

    if (
      !head ||
      !body
    ) {
      return;
    }

    const periods = {};

    GROUP_ORDER.forEach(
      function (group) {
        (
          groupedExpenses[
            group
          ] || []
        ).forEach(
          function (expense) {
            const key =
              getMonthKey(
                expense.Date
              );

            if (!periods[key]) {
              periods[key] = {};
            }

            periods[key][group] =
              (
                periods[key][group] ||
                0
              ) +
              (
                Number(
                  expense.Amount
                ) || 0
              );
          }
        );
      }
    );

    const keys =
      Object.keys(
        periods
      ).sort(
        function (a, b) {
          return (
            new Date(
              '1 ' + a
            ) -
            new Date(
              '1 ' + b
            )
          );
        }
      );

    head.innerHTML =
      '<th>Period</th>' +
      GROUP_ORDER
        .map(
          function (group) {
            return (
              '<th>' +
              clean(group) +
              '</th>'
            );
          }
        )
        .join('') +
      '<th>Total</th>';

    const totals = {};

    let grand = 0;

    let html = '';

    keys.forEach(
      function (key) {
        let rowTotal = 0;

        html +=
          '<tr>' +
          '<td><strong>' +
          clean(key) +
          '</strong></td>';

        GROUP_ORDER.forEach(
          function (group) {
            const amount =
              periods[key][group] ||
              0;

            rowTotal += amount;

            totals[group] =
              (
                totals[group] ||
                0
              ) +
              amount;

            html +=
              '<td>' +
              money(amount) +
              '</td>';
          }
        );

        grand += rowTotal;

        html +=
          '<td><strong>' +
          money(rowTotal) +
          '</strong></td>' +
          '</tr>';
      }
    );

    html +=
      '<tr style="font-weight:700;border-top:2px solid var(--color-border);">' +
      '<td>TOTAL</td>';

    GROUP_ORDER.forEach(
      function (group) {
        html +=
          '<td>' +
          money(
            totals[group] || 0
          ) +
          '</td>';
      }
    );

    html +=
      '<td>' +
      money(grand) +
      '</td>' +
      '</tr>';

    body.innerHTML =
      html;
  }

  function renderBlockProduction() {
    const body =
      document.getElementById(
        'blockProdRows'
      );

    if (!body) {
      return;
    }

    const rows =
      groupedExpenses[
        'Block Production'
      ] || [];

    const autoRows =
      rows.filter(
        function (row) {
          return (
            String(
              row[
                'Payment Method'
              ] || ''
            ) ===
            'Auto (Production Log)'
          );
        }
      );

    const manualRows =
      rows.filter(
        function (row) {
          return (
            String(
              row[
                'Payment Method'
              ] || ''
            ) !==
            'Auto (Production Log)'
          );
        }
      );

    body.innerHTML = `
      <tr>
        <td>
          Production of Blocks
        </td>

        <td>
          ${autoRows.length}
        </td>

        <td>
          ${money(
            totalRows(
              autoRows
            )
          )}
        </td>
      </tr>

      <tr>
        <td>
          Block Production Expenses
        </td>

        <td>
          ${manualRows.length}
        </td>

        <td>
          ${money(
            totalRows(
              manualRows
            )
          )}
        </td>
      </tr>

      <tr
        style="
          font-weight:700;
          border-top:2px solid var(--color-border);
        "
      >
        <td>
          TOTAL
        </td>

        <td>
          ${rows.length}
        </td>

        <td>
          ${money(
            totalRows(rows)
          )}
        </td>
      </tr>
    `;
  }

  function renderConcrete() {
    const body =
      document.getElementById(
        'concreteRows'
      );

    if (!body) {
      return;
    }

    const rows =
      groupedExpenses[
        'Concrete Works'
      ] || [];

    const totals = {};

    rows.forEach(
      function (row) {
        const category =
          String(
            row.Category ||
            'Miscellaneous'
          ).trim();

        if (!totals[category]) {
          totals[category] = {
            count: 0,
            amount: 0
          };
        }

        totals[
          category
        ].count += 1;

        totals[
          category
        ].amount +=
          Number(
            row.Amount
          ) || 0;
      }
    );

    const concreteTotal =
      totalRows(rows);

    const categories =
      Object.keys(
        totals
      ).sort(
        function (a, b) {
          return (
            totals[b].amount -
            totals[a].amount
          );
        }
      );

    if (
      !categories.length
    ) {
      body.innerHTML =
        '<tr><td colspan="4">No Concrete Works transactions found.</td></tr>';

      return;
    }

    body.innerHTML =
      categories
        .map(
          function (category) {
            const item =
              totals[category];

            const pct =
              concreteTotal > 0
                ? (
                    item.amount /
                    concreteTotal
                  ) * 100
                : 0;

            return `
              <tr>
                <td>
                  ${clean(category)}
                </td>

                <td>
                  ${item.count}
                </td>

                <td>
                  ${money(
                    item.amount
                  )}
                </td>

                <td>
                  ${pct.toFixed(1)}%
                </td>
              </tr>
            `;
          }
        )
        .join('') +

      `
        <tr
          style="
            font-weight:700;
            border-top:2px solid var(--color-border);
          "
        >
          <td>
            TOTAL CONCRETE WORKS
          </td>

          <td>
            ${rows.length}
          </td>

          <td>
            ${money(
              concreteTotal
            )}
          </td>

          <td>
            100.0%
          </td>
        </tr>
      `;
  }

  function getSandOrigin(row) {
    const origin =
      String(
        row.Origin || ''
      ).toLowerCase();

    return (
      origin.indexOf(
        'block production'
      ) !== -1
        ? 'Block Production'
        : 'Standalone / Other Sand'
    );
  }

  function getSandType(row) {
    const text =
      (
        String(
          row['Sand Type'] ||
          ''
        ) +
        ' ' +
        String(
          row.Description ||
          ''
        )
      ).toLowerCase();

    if (
      text.indexOf(
        'plaster'
      ) !== -1
    ) {
      return 'Plaster Sand';
    }

    if (
      text.indexOf(
        'sharp'
      ) !== -1
    ) {
      return 'Sharp Sand';
    }

    return 'Other Sand';
  }

  function renderSand() {
    const typeBody =
      document.getElementById(
        'sandTypeRows'
      );

    const sourceBody =
      document.getElementById(
        'sandSourceRows'
      );

    const detailBody =
      document.getElementById(
        'sandDetailRows'
      );

    const note =
      document.getElementById(
        'sandNote'
      );

    if (
      !typeBody ||
      !sourceBody ||
      !detailBody
    ) {
      return;
    }

    const typeTotals = {};
    const sourceTotals = {};

    sandEntries.forEach(
      function (row) {
        const type =
          getSandType(row);

        const source =
          getSandOrigin(row);

        const amount =
          Number(
            row.Amount
          ) || 0;

        const quantity =
          Number(
            row.Quantity
          ) || 0;

        if (
          !typeTotals[type]
        ) {
          typeTotals[type] = {
            count: 0,
            quantity: 0,
            amount: 0
          };
        }

        typeTotals[
          type
        ].count += 1;

        typeTotals[
          type
        ].quantity += quantity;

        typeTotals[
          type
        ].amount += amount;

        if (
          !sourceTotals[source]
        ) {
          sourceTotals[source] = {
            count: 0,
            amount: 0
          };
        }

        sourceTotals[
          source
        ].count += 1;

        sourceTotals[
          source
        ].amount += amount;
      }
    );

    const sandTotal =
      sandEntries.reduce(
        function (
          sum,
          row
        ) {
          return (
            sum +
            (
              Number(
                row.Amount
              ) || 0
            )
          );
        },
        0
      );

    const totalQty =
      sandEntries.reduce(
        function (
          sum,
          row
        ) {
          return (
            sum +
            (
              Number(
                row.Quantity
              ) || 0
            )
          );
        },
        0
      );

    typeBody.innerHTML =
      Object.keys(
        typeTotals
      )
        .map(
          function (type) {
            const item =
              typeTotals[type];

            const pct =
              sandTotal > 0
                ? (
                    item.amount /
                    sandTotal
                  ) * 100
                : 0;

            return `
              <tr>
                <td>
                  ${clean(type)}
                </td>

                <td>
                  ${item.count}
                </td>

                <td>
                  ${item.quantity || '—'}
                </td>

                <td>
                  ${money(
                    item.amount
                  )}
                </td>

                <td>
                  ${pct.toFixed(1)}%
                </td>
              </tr>
            `;
          }
        )
        .join('') +

      `
        <tr
          style="
            font-weight:700;
            border-top:2px solid var(--color-border);
          "
        >
          <td>
            TOTAL SAND
          </td>

          <td>
            ${sandEntries.length}
          </td>

          <td>
            ${totalQty || '—'}
          </td>

          <td>
            ${money(
              sandTotal
            )}
          </td>

          <td>
            100.0%
          </td>
        </tr>
      `;

    sourceBody.innerHTML =
      Object.keys(
        sourceTotals
      )
        .map(
          function (source) {
            return `
              <tr>

                <td>
                  ${clean(source)}
                </td>

                <td>
                  ${
                    sourceTotals[
                      source
                    ].count
                  }
                </td>

                <td>
                  ${money(
                    sourceTotals[
                      source
                    ].amount
                  )}
                </td>

              </tr>
            `;
          }
        )
        .join('');

    detailBody.innerHTML =
      sandEntries
        .slice()
        .sort(
          function (a, b) {
            const da =
              parseDate(
                a.Date
              );

            const db =
              parseDate(
                b.Date
              );

            return (
              (
                da
                  ? da.getTime()
                  : 0
              ) -
              (
                db
                  ? db.getTime()
                  : 0
              )
            );
          }
        )
        .map(
          function (row) {
            return `
              <tr>

                <td>
                  ${formatDate(
                    row.Date
                  )}
                </td>

                <td>
                  ${clean(
                    getSandType(row)
                  )}
                </td>

                <td>
                  ${clean(
                    row.Description ||
                    ''
                  )}
                </td>

                <td>
                  ${clean(
                    getSandOrigin(row)
                  )}
                </td>

                <td>
                  ${clean(
                    row.Quantity ||
                    '—'
                  )}
                </td>

                <td>
                  ${money(
                    row.Amount
                  )}
                </td>

              </tr>
            `;
          }
        )
        .join('');

    if (note) {
      const blockCount =
        sandEntries.filter(
          function (row) {
            return (
              getSandOrigin(
                row
              ) ===
              'Block Production'
            );
          }
        ).length;

      note.textContent =
        blockCount +
        ' block-production sand transactions · ' +
        (
          sandEntries.length -
          blockCount
        ) +
        ' other/standalone sand transactions';
    }
  }

  function renderCategoryDetail() {
    const select =
      document.getElementById(
        'detailGroupSelect'
      );

    const body =
      document.getElementById(
        'detailRows'
      );

    const empty =
      document.getElementById(
        'detailEmpty'
      );

    if (
      !select ||
      !body ||
      !empty
    ) {
      return;
    }

    select.innerHTML =
      GROUP_ORDER
        .map(
          function (group) {
            return `
              <option
                value="${clean(group)}"
              >
                ${clean(group)}
              </option>
            `;
          }
        )
        .join('');

    function renderGroup(group) {
      const rows =
        groupedExpenses[
          group
        ] || [];

      if (!rows.length) {
        body.innerHTML = '';

        empty.style.display =
          'block';

        return;
      }

      empty.style.display =
        'none';

      body.innerHTML =
        rows
          .map(
            function (row) {
              return `
                <tr>

                  <td>
                    ${formatDate(
                      row.Date
                    )}
                  </td>

                  <td>
                    ${clean(
                      row.Category
                    )}
                  </td>

                  <td>
                    ${clean(
                      row.Description ||
                      ''
                    )}
                  </td>

                  <td>
                    ${clean(
                      row.Vendor ||
                      '—'
                    )}
                  </td>

                  <td>
                    ${money(
                      row.Amount
                    )}
                  </td>

                  <td>
                    ${clean(
                      row[
                        'Payment Method'
                      ] ||
                      '—'
                    )}
                  </td>

                </tr>
              `;
            }
          )
          .join('') +

        `
          <tr
            style="
              font-weight:700;
              border-top:2px solid var(--color-border);
            "
          >

            <td colspan="4">
              TOTAL
            </td>

            <td>
              ${money(
                totalRows(rows)
              )}
            </td>

            <td></td>

          </tr>
        `;
    }

    select.addEventListener(
      'change',
      function () {
        renderGroup(
          select.value
        );
      }
    );

    if (
      GROUP_ORDER.length
    ) {
      renderGroup(
        GROUP_ORDER[0]
      );
    }
  }

  function addDownloadHandler() {
    const button =
      document.getElementById(
        'downloadExcelBtn'
      );

    if (
      button &&
      !button.dataset.wired
    ) {
      button.addEventListener(
        'click',
        exportExcel
      );

      button.dataset.wired =
        '1';
    }
  }

  function addSafeSheet(
    workbook,
    name,
    rows
  ) {
    const worksheet =
      XLSX.utils.json_to_sheet(
        rows || []
      );

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      name.substring(
        0,
        31
      )
    );
  }

  function exportExcel() {
    if (
      typeof XLSX ===
      'undefined'
    ) {
      showToast(
        'Excel library did not load.',
        'error'
      );

      return;
    }

    try {
      const workbook =
        XLSX.utils.book_new();

      const summary =
        GROUP_ORDER.map(
          function (group) {
            const rows =
              groupedExpenses[
                group
              ] || [];

            return {
              Category:
                group,

              Transactions:
                rows.length,

              Amount:
                totalRows(rows)
            };
          }
        );

      summary.push({
        Category:
          'GRAND TOTAL',

        Transactions:
          allExpenses.length,

        Amount:
          totalRows(
            allExpenses
          )
      });

      addSafeSheet(
        workbook,
        'Summary',
        summary
      );

      const periods = {};

      allExpenses.forEach(
        function (row) {
          const period =
            getMonthKey(
              row.Date
            );

          const group =
            GROUP_OF[
              row.Category
            ] ||
            'Other Expenses';

          if (
            !periods[period]
          ) {
            periods[period] = {};
          }

          periods[period][
            group
          ] =
            (
              periods[period][
                group
              ] || 0
            ) +
            (
              Number(
                row.Amount
              ) || 0
            );
        }
      );

      const byPeriod = [];

      Object.keys(
        periods
      )
        .sort(
          function (a, b) {
            return (
              new Date(
                '1 ' + a
              ) -
              new Date(
                '1 ' + b
              )
            );
          }
        )
        .forEach(
          function (period) {
            const record = {
              Period:
                period
            };

            let total = 0;

            GROUP_ORDER.forEach(
              function (group) {
                const amount =
                  periods[period][
                    group
                  ] || 0;

                record[group] =
                  amount;

                total += amount;
              }
            );

            record.Total =
              total;

            byPeriod.push(
              record
            );
          }
        );

      addSafeSheet(
        workbook,
        'By Period',
        byPeriod
      );

      /*
       * BLOCK PRODUCTION
       * Created once here.
       */
      const blockProduction =
        (
          groupedExpenses[
            'Block Production'
          ] || []
        ).map(
          function (row) {
            return {
              Date:
                row.Date,

              Category:
                row.Category,

              Description:
                row.Description ||
                '',

              Amount:
                Number(
                  row.Amount
                ) || 0,

              Vendor:
                row.Vendor ||
                '',

              PaymentMethod:
                row[
                  'Payment Method'
                ] ||
                ''
            };
          }
        );

      addSafeSheet(
        workbook,
        'Block Production',
        blockProduction
      );

      const blockAuto =
        (
          groupedExpenses[
            'Block Production'
          ] || []
        ).filter(
          function (row) {
            return (
              String(
                row[
                  'Payment Method'
                ] || ''
              ) ===
              'Auto (Production Log)'
            );
          }
        );

      const blockManual =
        (
          groupedExpenses[
            'Block Production'
          ] || []
        ).filter(
          function (row) {
            return (
              String(
                row[
                  'Payment Method'
                ] || ''
              ) !==
              'Auto (Production Log)'
            );
          }
        );

      addSafeSheet(
        workbook,
        'Block Prod Summary',
        [
          {
            Section:
              'Production of Blocks',

            Transactions:
              blockAuto.length,

            Amount:
              totalRows(
                blockAuto
              )
          },

          {
            Section:
              'Block Production Expenses',

            Transactions:
              blockManual.length,

            Amount:
              totalRows(
                blockManual
              )
          },

          {
            Section:
              'TOTAL',

            Transactions:
              blockProduction.length,

            Amount:
              totalRows(
                blockProduction
              )
          }
        ]
      );

      /*
       * CONCRETE WORKS
       * Created once here.
       */
      const concrete =
        (
          groupedExpenses[
            'Concrete Works'
          ] || []
        ).map(
          function (row) {
            return {
              Date:
                row.Date,

              Category:
                row.Category,

              Description:
                row.Description ||
                '',

              Amount:
                Number(
                  row.Amount
                ) || 0,

              Vendor:
                row.Vendor ||
                '',

              PaymentMethod:
                row[
                  'Payment Method'
                ] ||
                ''
            };
          }
        );

      addSafeSheet(
        workbook,
        'Concrete Works',
        concrete
      );

      const concreteTotals = {};

      (
        groupedExpenses[
          'Concrete Works'
        ] || []
      ).forEach(
        function (row) {
          const category =
            row.Category ||
            'Miscellaneous';

          concreteTotals[
            category
          ] =
            (
              concreteTotals[
                category
              ] || 0
            ) +
            (
              Number(
                row.Amount
              ) || 0
            );
        }
      );

      const concreteSummary =
        Object.keys(
          concreteTotals
        ).map(
          function (category) {
            return {
              Component:
                category,

              Amount:
                concreteTotals[
                  category
                ]
            };
          }
        );

      concreteSummary.push({
        Component:
          'TOTAL CONCRETE WORKS',

        Amount:
          totalRows(
            groupedExpenses[
              'Concrete Works'
            ] || []
          )
      });

      addSafeSheet(
        workbook,
        'Concrete Breakdown',
        concreteSummary
      );

      /*
       * EXCAVATION
       */
      const excavation =
        (
          groupedExpenses[
            'Excavation of Trenches'
          ] || []
        ).map(
          function (row) {
            return {
              Date:
                row.Date,

              Category:
                row.Category,

              Description:
                row.Description ||
                '',

              Amount:
                Number(
                  row.Amount
                ) || 0,

              Vendor:
                row.Vendor ||
                '',

              PaymentMethod:
                row[
                  'Payment Method'
                ] ||
                ''
            };
          }
        );

      addSafeSheet(
        workbook,
        'Excavation',
        excavation
      );

      addSafeSheet(
        workbook,
        'Excavation Summary',
        [
          {
            Section:
              'Excavation of Trenches',

            Transactions:
              excavation.length,

            Amount:
              totalRows(
                excavation
              )
          }
        ]
      );

      /*
       * BLOCK PRODUCTION SAND
       */
      const blockSand =
        sandEntries
          .filter(
            function (row) {
              return (
                getSandOrigin(
                  row
                ) ===
                'Block Production'
              );
            }
          )
          .map(
            function (row) {
              return {
                Date:
                  row.Date,

                SandType:
                  getSandType(
                    row
                  ),

                Description:
                  row.Description ||
                  '',

                Quantity:
                  row.Quantity ||
                  '',

                Amount:
                  Number(
                    row.Amount
                  ) || 0,

                Source:
                  'Block Production'
              };
            }
          );

      addSafeSheet(
        workbook,
        'Block Prod Sand',
        blockSand
      );

      /*
       * OTHER / STANDALONE SAND
       */
      const otherSand =
        sandEntries
          .filter(
            function (row) {
              return (
                getSandOrigin(
                  row
                ) !==
                'Block Production'
              );
            }
          )
          .map(
            function (row) {
              return {
                Date:
                  row.Date,

                SandType:
                  getSandType(
                    row
                  ),

                Description:
                  row.Description ||
                  '',

                Quantity:
                  row.Quantity ||
                  '',

                Amount:
                  Number(
                    row.Amount
                  ) || 0,

                Source:
                  'Standalone / Other Sand'
              };
            }
          );

      addSafeSheet(
        workbook,
        'Other Sand',
        otherSand
      );

      /*
       * SAND DETAIL
       */
      addSafeSheet(
        workbook,
        'Sand Detail',
        sandEntries.map(
          function (row) {
            return {
              Date:
                row.Date,

              SandType:
                getSandType(
                  row
                ),

              Description:
                row.Description ||
                '',

              Source:
                getSandOrigin(
                  row
                ),

              Quantity:
                row.Quantity ||
                '',

              Amount:
                Number(
                  row.Amount
                ) || 0
            };
          }
        )
      );

      /*
       * SAND RECONCILIATION
       */
      addSafeSheet(
        workbook,
        'Sand Reconciliation',
        [
          {
            Source:
              'Block Production Sand',

            Transactions:
              blockSand.length,

            Amount:
              totalRows(
                blockSand
              )
          },

          {
            Source:
              'Standalone / Other Sand',

            Transactions:
              otherSand.length,

            Amount:
              totalRows(
                otherSand
              )
          },

          {
            Source:
              'TOTAL SAND',

            Transactions:
              sandEntries.length,

            Amount:
              totalRows(
                sandEntries
              )
          }
        ]
      );

      /*
       * CREATE THE REMAINING CATEGORY SHEETS.
       *
       * IMPORTANT:
       * Block Production and Concrete Works already
       * have dedicated sheets above. Skipping them here
       * prevents the "Worksheet already exists" error.
       */
      GROUP_ORDER.forEach(
        function (group) {

          if (
            group ===
              'Block Production' ||
            group ===
              'Concrete Works'
          ) {
            return;
          }

          const rows =
            (
              groupedExpenses[
                group
              ] || []
            ).map(
              function (row) {
                return {
                  Date:
                    row.Date,

                  Category:
                    row.Category,

                  Description:
                    row.Description ||
                    '',

                  Amount:
                    Number(
                      row.Amount
                    ) || 0,

                  Vendor:
                    row.Vendor ||
                    '',

                  PaymentMethod:
                    row[
                      'Payment Method'
                    ] ||
                    ''
                };
              }
            );

          addSafeSheet(
            workbook,
            group,
            rows
          );
        }
      );

      XLSX.writeFile(
        workbook,
        'Site_Expense_Final_Report_' +
        new Date()
          .toISOString()
          .slice(0, 10) +
        '.xlsx'
      );

      showToast(
        'Excel report downloaded.',
        'success'
      );

    } catch (error) {

      console.error(
        'Excel export error:',
        error
      );

      showToast(
        'Excel export failed: ' +
        (
          error.message ||
          'Unknown error'
        ),
        'error'
      );
    }
  }

  async function loadReport() {

    if (!currentUser) {
      currentUser =
        await Auth.requireRole(
          [
            'Admin',
            'Boss'
          ]
        );
    }

    if (!currentUser) {
      return;
    }

    const results =
      await Promise.all(
        [
          Api.getExpenses(),

          Api.getBlockProduction(),

          Api.getSandEntries()
            .catch(
              function () {
                return {
                  entries: []
                };
              }
            )
        ]
      );

    allExpenses =
      results[0] &&
      Array.isArray(
        results[0].expenses
      )
        ? results[0].expenses
        : [];

    blockProductionEntries =
      results[1] &&
      Array.isArray(
        results[1].entries
      )
        ? results[1].entries
        : [];

    sandEntries =
      results[2] &&
      Array.isArray(
        results[2].entries
      )
        ? results[2].entries
        : [];

    groupData();

    renderSummary();

    renderByPeriod();

    renderBlockProduction();

    renderConcrete();

    renderSand();

    renderCategoryDetail();

    addDownloadHandler();

    if (
      currentUser.role ===
      'Admin'
    ) {
      setupAdminRecategorize();
    }
  }

  function setupAdminRecategorize() {

    const card =
      document.getElementById(
        'recategorizeCard'
      );

    const select =
      document.getElementById(
        'recatFromCategory'
      );

    const preview =
      document.getElementById(
        'recatPreviewBtn'
      );

    const apply =
      document.getElementById(
        'recatApplyBtn'
      );

    const box =
      document.getElementById(
        'recatPreviewBox'
      );

    if (
      !card ||
      !select ||
      !preview ||
      !apply ||
      !box
    ) {
      return;
    }

    card.style.display =
      'block';

    const possible =
      GROUP_ORDER
        .map(
          function (group) {
            return (
              GROUPS[group] ||
              []
            );
          }
        )
        .reduce(
          function (
            all,
            categories
          ) {
            return all.concat(
              categories
            );
          },
          []
        )
        .filter(
          function (category) {
            return allExpenses.some(
              function (expense) {
                return (
                  expense.Category ===
                  category
                );
              }
            );
          }
        );

    select.innerHTML =
      possible
        .map(
          function (category) {
            return `
              <option
                value="${clean(category)}"
              >
                ${clean(category)}
              </option>
            `;
          }
        )
        .join('');

    if (
      possible.indexOf(
        'Excavation of Trenches'
      ) !== -1
    ) {
      select.value =
        'Excavation of Trenches';
    }

    preview.onclick =
      async function () {

        try {

          if (!select.value) {

            showToast(
              'Select a category first.',
              'error'
            );

            return;
          }

          const result =
            await Api.autoRecategorize(
              select.value,
              true
            );

          if (
            !result ||
            !result.totalMatches
          ) {

            box.innerHTML =
              '<p>No new historical category matches found.</p>';

            apply.style.display =
              'none';

            return;
          }

          box.innerHTML =
            '<pre style="white-space:pre-wrap;">' +
            clean(
              JSON.stringify(
                result.byNewCategory,
                null,
                2
              )
            ) +
            '</pre>';

          apply.style.display =
            'inline-flex';

        } catch (error) {

          console.error(
            'Recategorization preview error:',
            error
          );

          showToast(
            error.message ||
            'Preview failed.',
            'error'
          );
        }
      };

    apply.onclick =
      async function () {

        try {

          if (
            !window.confirm(
              'Apply these historical category changes?'
            )
          ) {
            return;
          }

          const result =
            await Api.autoRecategorize(
              select.value,
              false
            );

          const count =
            result &&
            result.totalMatches
              ? result.totalMatches
              : 0;

          showToast(
            count +
            ' transaction(s) updated.',
            'success'
          );

          window.location.reload();

        } catch (error) {

          console.error(
            'Recategorization apply error:',
            error
          );

          showToast(
            error.message ||
            'Could not apply category changes.',
            'error'
          );
        }
      };
  }

  async function start() {

    try {

      currentUser =
        await Auth.requireRole(
          [
            'Admin',
            'Boss'
          ]
        );

      if (!currentUser) {
        return;
      }

      if (
        typeof Layout !==
          'undefined' &&
        Layout.build
      ) {

        Layout.build(
          'final-report.html',
          currentUser
        );
      }

      const template =
        document.getElementById(
          'pageContent'
        );

      if (
        template &&
        typeof Layout !==
          'undefined' &&
        Layout.mainMount
      ) {

        Layout.mainMount()
          .innerHTML =
          template.innerHTML;
      }

      const menuButton =
        document.getElementById(
          'menuBtn'
        );

      if (
        menuButton &&
        typeof Layout !==
          'undefined' &&
        Layout.toggleSidebar
      ) {

        menuButton.addEventListener(
          'click',
          Layout.toggleSidebar
        );
      }

      await loadReport();

    } catch (error) {

      console.error(
        'Final Report startup error:',
        error
      );

      const existing =
        document.getElementById(
          'finalReportStartupError'
        );

      if (existing) {
        return;
      }

      const mount =
        document.querySelector(
          'main'
        ) ||
        document.body;

      const errorBox =
        document.createElement(
          'div'
        );

      errorBox.id =
        'finalReportStartupError';

      errorBox.style.cssText =
        'margin:20px;' +
        'padding:18px;' +
        'border:1px solid #dc3545;' +
        'border-radius:10px;' +
        'background:#fff5f5;' +
        'color:#842029;' +
        'font-family:Arial,sans-serif;' +
        'line-height:1.5;';

      errorBox.innerHTML =
        '<strong>' +
        'Final Report failed to load.' +
        '</strong><br><br>' +
        clean(
          error &&
          error.message
            ? error.message
            : 'Unknown startup error.'
        );

      mount.appendChild(
        errorBox
      );
    }
  }

  start();

})();
