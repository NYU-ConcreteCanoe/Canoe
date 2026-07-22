/* ==============================================
   NYU CONCRETE CANOE - DRAG SCROLL
   Shared behaviour for horizontal rails: click-drag,
   vertical wheel mapped to sideways movement, and
   arrow keys. Used by the news strip and the timeline.

   Exposes window.enableDragScroll(element, options).
   ============================================== */

(function () {
  "use strict";

  window.enableDragScroll = function (rail, options) {
    if (!rail) return;
    var opts = options || {};
    var step = opts.step || 0;

    var down = false, startX = 0, startScroll = 0, moved = 0, onText = false;

    rail.addEventListener("pointerdown", function (e) {
      // Let links and buttons keep their normal click behaviour.
      if (e.target.closest("a, button")) return;
      // On text: leave it selectable, don't drag.
      onText = !!e.target.closest(".news-body, .t-text");
      down = true;
      moved = 0;
      startX = e.clientX;
      startScroll = rail.scrollLeft;
    });

    rail.addEventListener("pointermove", function (e) {
      if (!down || onText) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      // Begin dragging only past a small threshold.
      if (moved > 4) {
        rail.classList.add("is-dragging");
        if (rail.setPointerCapture) {
          try { rail.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
      }
      rail.scrollLeft = startScroll - dx;
    });

    function end(e) {
      if (!down) return;
      down = false;
      rail.classList.remove("is-dragging");
      if (rail.releasePointerCapture && e && e.pointerId != null) {
        try { rail.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    }

    rail.addEventListener("pointerup", end);
    rail.addEventListener("pointercancel", end);
    rail.addEventListener("pointerleave", end);

    // Suppress the click that follows a real drag, otherwise releasing over a
    // link navigates unintentionally.
    rail.addEventListener("click", function (e) {
      if (moved > 4) {
        e.preventDefault();
        e.stopPropagation();
        moved = 0;
      }
    }, true);

    // A vertical wheel over the rail moves it sideways, but only while it
    // still has room. At either end the page takes over again, so the user is
    // never trapped in the rail.
    rail.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var atStart = rail.scrollLeft <= 0;
      var atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }, { passive: false });

    // Keyboard access for the focused rail.
    rail.addEventListener("keydown", function (e) {
      var amount = step || rail.clientWidth * 0.8;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        rail.scrollBy({ left: amount, behavior: "smooth" });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        rail.scrollBy({ left: -amount, behavior: "smooth" });
      } else if (e.key === "Home") {
        e.preventDefault();
        rail.scrollTo({ left: 0, behavior: "smooth" });
      } else if (e.key === "End") {
        e.preventDefault();
        rail.scrollTo({ left: rail.scrollWidth, behavior: "smooth" });
      }
    });
  };
})();
